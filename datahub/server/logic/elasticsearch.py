from cgi import escape
import json
import re

from elasticsearch import Elasticsearch, RequestsHttpConnection

from lib.utils.utils import (
    DATETIME_TO_UTC,
    with_exception,
)
from lib.utils.decorators import in_mem_memoized
from lib.logger import get_logger
from lib.config import get_config_value
from app.db import (
    # TODO: We should use slave instead
    with_session,
)
from logic.datadoc import get_all_data_docs, get_data_doc_by_id
from logic.metastore import (
    get_all_table,
    get_table_by_id,
)
from models.user import User
from models.datadoc import DataCellType
from env import DataHubSettings


LOG = get_logger(__file__)
ES_CONFIG = get_config_value("elasticsearch")


@in_mem_memoized(3600)
def get_hosted_es():
    hosted_es = None

    if ":" in DataHubSettings.ELASTICSEARCH_HOST:
        host, port = DataHubSettings.ELASTICSEARCH_HOST.split(":")
    else:
        host = DataHubSettings.ELASTICSEARCH_HOST
        port = 9200  # Default port for elasticsearch

    if DataHubSettings.ELASTICSEARCH_CONNECTION_TYPE == "naive":
        hosted_es = Elasticsearch(hosts=[host], port=port,)
    elif DataHubSettings.ELASTICSEARCH_CONNECTION_TYPE == "aws":
        # TODO: GENERALIZE THIS BEFORE OPEN SOURCE
        from boto3 import session as boto_session
        from requests_aws4auth import AWS4Auth

        credentials = boto_session.Session().get_credentials()
        auth = AWS4Auth(
            credentials.access_key,
            credentials.secret_key,
            "us-east-1",
            "es",
            session_token=credentials.token,
        )
        hosted_es = Elasticsearch(
            hosts=DataHubSettings.ELASTICSEARCH_HOST,
            port=443,
            http_auth=auth,
            connection_class=RequestsHttpConnection,
            use_ssl=True,
            verify_certs=True,
        )
    return hosted_es


"""
    DATA DOCS
"""


@with_session
def get_datadocs_iter(batch_size=5000, session=None):
    offset = 0

    while True:
        data_docs = get_all_data_docs(limit=batch_size, offset=offset, session=session,)
        LOG.info("\n--Datadocs count: {}, offset: {}".format(len(data_docs), offset))

        for data_doc in data_docs:
            expand_datadoc = datadocs_to_es(data_doc, session=session)
            yield expand_datadoc

        if len(data_docs) < batch_size:
            break
        offset += batch_size


@with_session
def datadocs_to_es(datadoc, session=None):
    title = datadoc.title

    cells_as_text = []
    for cell in datadoc.cells:
        if cell.cell_type == DataCellType.text:
            cells_as_text.append(simple_parse_draftjs_content_state(cell.context) or "")
        elif cell.cell_type == DataCellType.query:
            cell_title = cell.meta.get("title", "")
            cell_text = (
                cell.context if not cell_title else f"{cell_title}\n{cell.context}"
            )
            cells_as_text.append(cell_text)
        else:
            cells_as_text.append("[... additional unparsable content ...]")

    joined_cells = escape("\n".join(cells_as_text))
    expand_datadoc = {
        "id": datadoc.id,
        "environment_id": datadoc.environment_id,
        "owner_uid": datadoc.owner_uid,
        "created_at": DATETIME_TO_UTC(datadoc.created_at),
        "cells": joined_cells,
        "title": title,
    }
    return expand_datadoc


@with_exception
def simple_parse_draftjs_content_state(value):
    try:
        content_state = json.loads(value)
    except Exception:
        # For old text cells the value was plain text
        LOG.debug("Text cell is not json, content: {}".format(value))
        return value

    blocks = content_state.get("blocks", [])
    blocks_text = [block.get("text", "") for block in blocks]
    joined_blocks = "\n".join(blocks_text)
    return joined_blocks


@with_exception
def _bulk_insert_datadocs():
    type_name = ES_CONFIG["datadocs"]["type_name"]
    index_name = ES_CONFIG["datadocs"]["index_name"]

    for datadoc in get_datadocs_iter():
        _insert(index_name, type_name, datadoc["id"], datadoc)


@with_exception
@with_session
def update_data_doc_by_id(doc_id, session=None):
    type_name = ES_CONFIG["datadocs"]["type_name"]
    index_name = ES_CONFIG["datadocs"]["index_name"]

    doc = get_data_doc_by_id(doc_id, session=session)
    if doc is None or doc.archived:
        try:
            _delete(index_name, type_name, id=doc_id)
        except Exception:
            LOG.error("failed to delete {}. Will pass.".format(doc_id))
    else:
        formatted_object = datadocs_to_es(doc, session=session)
        try:
            # Try to update if present
            updated_body = {
                "doc": formatted_object,
                "doc_as_upsert": True,
            }  # ES requires this format for updates
            _update(index_name, type_name, doc_id, updated_body)
        except Exception:
            LOG.error("failed to upsert {}. Will pass.".format(doc_id))


"""
    TABLES
"""


@with_session
def get_tables_iter(batch_size=5000, session=None):
    offset = 0

    while True:
        tables = get_all_table(limit=batch_size, offset=offset, session=session,)
        LOG.info("\n--Table count: {}, offset: {}".format(len(tables), offset))

        for table in tables:
            expand_table = table_to_es(table, session=session)
            yield expand_table

        if len(tables) < batch_size:
            break
        offset += batch_size


@with_session
def table_to_es(table, session=None):
    schema = table.data_schema

    column_names = map(lambda c: c.name, table.columns)
    schema_name = schema.name
    table_name = table.name
    description = escape(
        (
            simple_parse_draftjs_content_state(table.information.description)
            if table.information
            else ""
        )
        or ""
    )

    full_name = "{}.{}".format(schema_name, table_name)

    # TODO: Allow dynamic weight to tables
    weight = 0

    table_name_words = list(filter(lambda s: len(s), table_name.split("_")))
    schema_words = list(filter(lambda s: len(s), schema_name.split("_")))
    full_name_spaces = " ".join(schema_words + table_name_words)

    column_names_spaces = " ".join(
        [
            " ".join(list(filter(lambda s: len(s), column_name.split("_"))))
            for column_name in column_names or []
        ]
    )

    expand_table = {
        "id": table.id,
        "metastore_id": schema.metastore_id,
        "schema": schema_name,
        "name": table_name,
        "full_name": full_name_spaces,
        "completion_name": {
            "input": [full_name, table_name,],
            "weight": weight,
            "contexts": {"metastore_id": schema.metastore_id,},
        },
        "description": description,
        "created_at": DATETIME_TO_UTC(table.created_at),
        "columns": column_names_spaces,
        "golden": table.golden,
    }
    return expand_table


def _bulk_insert_tables():
    type_name = ES_CONFIG["tables"]["type_name"]
    index_name = ES_CONFIG["tables"]["index_name"]

    for table in get_tables_iter():
        _insert(index_name, type_name, table["id"], table)


@with_exception
@with_session
def update_table_by_id(table_id, session=None):
    type_name = ES_CONFIG["tables"]["type_name"]
    index_name = ES_CONFIG["tables"]["index_name"]

    table = get_table_by_id(table_id, session=session)
    if table is None:
        delete_es_table_by_id(table_id)
    else:
        formatted_object = table_to_es(table, session=session)
        try:
            # Try to update if present
            updated_body = {
                "doc": formatted_object,
                "doc_as_upsert": True,
            }  # ES requires this format for updates
            _update(index_name, type_name, table_id, updated_body)
        except Exception:
            # Otherwise insert as new
            LOG.error("failed to upsert {}. Will pass.".format(table_id))


def delete_es_table_by_id(table_id,):
    type_name = ES_CONFIG["tables"]["type_name"]
    index_name = ES_CONFIG["tables"]["index_name"]
    try:
        _delete(index_name, type_name, id=table_id)
    except Exception:
        LOG.error("failed to delete {}. Will pass.".format(table_id))


"""
    USERS
"""


def process_names_for_suggestion(*args):
    """Process names (remove non alpha chars, lowercase, trim)
       Break each name word and re-insert them in to the array along with the original name
       (ex 'John Smith 123' -> ['John Smith', 'John', 'Smith'] )
    Returns:
        [List[str]] -- a list of words
    """
    words = []
    for name in args:
        name_processed = re.sub(r"[\(\)\\\/0-9]+", "", name or "").strip().lower()
        name_words = name_processed.split()
        words.append(name_processed)
        words += name_words
    return words


@with_session
def user_to_es(user, session=None):
    username = user.username or ""
    fullname = user.fullname or ""

    return {
        "id": user.id,
        "username": username,
        "fullname": fullname,
        "suggest": {"input": process_names_for_suggestion(username, fullname),},
    }


@with_session
def get_users_iter(batch_size=5000, session=None):
    offset = 0

    while True:
        users = User.get_all(limit=batch_size, offset=offset, session=session,)
        LOG.info("\n--User count: {}, offset: {}".format(len(users), offset))

        for user in users:
            expanded_user = user_to_es(user, session=session)
            yield expanded_user

        if len(users) < batch_size:
            break
        offset += batch_size


def _bulk_insert_users():
    type_name = ES_CONFIG["users"]["type_name"]
    index_name = ES_CONFIG["users"]["index_name"]

    for user in get_users_iter():
        _insert(index_name, type_name, user["id"], user)


@with_exception
@with_session
def update_user_by_id(uid, session=None):
    type_name = ES_CONFIG["users"]["type_name"]
    index_name = ES_CONFIG["users"]["index_name"]

    user = User.get(id=uid, session=session)
    if user is None or user.deleted:
        try:
            _delete(index_name, type_name, id=uid)
        except Exception:
            LOG.error("failed to delete {}. Will pass.".format(uid))
    else:
        formatted_object = user_to_es(user, session=session)
        try:
            # Try to update if present
            updated_body = {
                "doc": formatted_object,
                "doc_as_upsert": True,
            }  # ES requires this format for updates
            _update(index_name, type_name, uid, updated_body)
        except Exception:
            LOG.error("failed to upsert {}. Will pass.".format(uid))


"""
    Elastic Search Utils
"""


def _insert(index_name, doc_type, id, content):
    get_hosted_es().index(index=index_name, doc_type=doc_type, id=id, body=content)


def _delete(index_name, doc_type, id):
    get_hosted_es().delete(index=index_name, doc_type=doc_type, id=id)


def _update(index_name, doc_type, id, content):
    get_hosted_es().update(index=index_name, doc_type=doc_type, id=id, body=content)


def create_indices():
    for es_config in ES_CONFIG.values():
        get_hosted_es().indices.create(es_config["index_name"], es_config["mappings"])

    LOG.info("Inserting datadocs")
    _bulk_insert_datadocs()

    LOG.info("Inserting tables")
    _bulk_insert_tables()

    LOG.info("Inserting users")
    _bulk_insert_users()


def create_indices_if_not_exist():
    for es_config in ES_CONFIG.values():
        if not get_hosted_es().indices.exists(index=es_config["index_name"]):
            get_hosted_es().indices.create(
                es_config["index_name"], es_config["mappings"]
            )
            if es_config["type_name"] == "datadocs":
                LOG.info("Inserting datadocs")
                _bulk_insert_datadocs()
            elif es_config["type_name"] == "tables":
                LOG.info("Inserting tables")
                _bulk_insert_tables()
            elif es_config["type_name"] == "users":
                LOG.info("Inserting users")
                _bulk_insert_users()


def delete_indices():
    for es_config in ES_CONFIG.values():
        get_hosted_es().indices.delete(es_config["index_name"])