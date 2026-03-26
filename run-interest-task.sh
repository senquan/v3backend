#!/bin/bash
# 进入项目目录
cd /www/fms/backend-dev

# 执行任务并记录日志
/usr/local/node-v25.1.0-linux-x64/bin/node dist/tasks/interest-calculation.task.js >> /var/log/fms-dev-interest-task.log 2>&1