from celery.signals import celeryd_init
from celery.utils.log import get_task_logger

from app.flask_app import celery
from env import DataHubSettings

from .run_query import run_query_task
from .dummy_task import dummy_task
from .update_metastore import update_metastore
from .sync_elasticsearch import sync_elasticsearch
from .run_datadoc import run_datadoc
from .delete_mysql_cache import delete_mysql_cache
from .poll_engine_status import poll_engine_status
from .presto_hive_function_scrapper import presto_hive_function_scrapper

from importlib import import_module

try:
    tasks_module = import_module("tasks_plugin")
except (ImportError, ModuleNotFoundError) as err:
    print("Cannot import %s for tasks due to: %s", "task_plugin", err)

# Linter
celery
run_query_task
dummy_task
update_metastore
sync_elasticsearch
run_datadoc
delete_mysql_cache
poll_engine_status
presto_hive_function_scrapper

LOG = get_task_logger(__name__)


@celeryd_init.connect
def configure_workers(sender=None, conf=None, **kwargs):
    if DataHubSettings.PRODUCTION:
        LOG.info(f"Starting PROD Celery worker: {sender}")

        from logic.query_execution import clean_up_query_execution

        clean_up_query_execution()
    else:
        LOG.info(f"Starting DEV Celery worker: {sender}")