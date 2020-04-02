---
id: plugins
title: Plugins
sidebar_label: Plugins
---

## Overview

Plugins provide a simple way for admins to add their org specific code to DataHub without modifying the open sourced code. This guide will cover all the plugins that can be added as well as the required steps needed to install plugins on DataHub.

## Types of plugins

In this section we will cover different types of plugins and their use cases.

### Query Engine Plugin

Query engine plugin is useful if you want to add custom query engines that are not supported in DataHub or add different behaviors in the default query engines.

If you are adding a new custom query engine, please check the [Add Query Engine guide](../developer_guide/add_query_engine.md) in the developer guide to learn how to add a query engine.

If you are extending the default query engine, you can create a new engine executor that inherits from the current query engines and override any behavior it has.

### Auth Plugin

Auth plugin can be used to add different authentication methods to DataHub as well as adding custom behavior behaviors after a user authenticates. An example of the latter case is to automatically add users to different environments based on additional user permission queries. Please check [Add Auth guide](../developer_guide/add_auth.md) to learn how to add a new auth plugin.


### Engine Status Checker

Engine status checker plugin lets you customize how you want to expose the backend query engine information to the frontend user. Place your custom logic under engine_status_checker_plugin/. Please check [Add Engine Status Checker guide](../developer_guide/add_engine_status_checker.md) to learn how to add a new engine status checker.


### Exporter Plugin

Exporters are ways to provide a quick way for user to move their query results to external websites. DataHub by default provides "python exporter" and "r exporter" code but they need to included in the plugin exporter to be used. Please check [Add Exporter guide](../developer_guide/add_exporter.md) to learn how to add a new exporter and different types of exporters.

### Job Plugin

Admins can use job plugin to add new job schedules to DataHub. DataHub provides various types of jobs such as retention jobs but they are unscheduled unless it is included in job plugin. You can also use job plugin to schedule tasks from task plugin. Please check [Add Custom Jobs guide](../admin_guide/add_custom_jobs.md) to see the formatting required.

### Metastore Plugin

Similar to Query engine, metastore plugins provides a way for admins to configure how a metastore can be populated. Users can use it add new ways to load table information. Please check [Add Metastore guide](../developer_guide/add_metastore.md) to learn how to add a new metastore loader.


### Result Store Plugin

By default, datahub supports storing query results/logs to and from s3 and sqlalchemy database. If other store is needed (such as local file system or google cloud), you can add a custom result store exporter. Please check [Add Result Store guide](../developer_guide/add_result_store.md) for more details.


### Task Plugin

Task plugin lets you implement custom async tasks on datahub. For example, you can add a task which refreshes user's profile pic from an external source or add a task that checks if a user still has their access to an environment.

### Web Page Plugin

Web page plugin allows you to inject custom js, css to DataHub. Place your custom logic under webpage_plugin/custom_script.js to inject it into the Datahub webapp.


## Installing Plugins

0. Ensure you can run the vanilla DataHub

Please ensure you can spin up DataHub's docker images (webserver, scheduler, workers) and able to set environment variables. Check "Setup DataHub" for more details.

1. Setup a new project folder for DataHub plugins

DataHub can be pulled from dockerhub directly, so this is mainly used for plugins and custom environment settings.

2. Copy plugins folder from the DataHub repo

Copy the `plugins` folder from the root directory of this project to the custom project folder.

3. Extending the docker image and install dependencies

Create a new dockerfile which can be used to install additional libraries and dependencies. Make sure to also COPY the plugins folder into the docker image.

4. Pack the plugins with the new docker image

Last but not least, remember to set docker environment variable DATAHUB_PLUGIN to the path of the plugins folder and also include it as part of the PYTHONPATH.