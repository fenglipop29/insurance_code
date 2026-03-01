# 任务导入说明（Jira / Linear）

文件：
- Jira: `./jira-import-backend-v1.csv`
- Linear: `./linear-import-backend-v1.csv`

说明：
- 计划周期按 2026-02-23 至 2026-03-06（10个工作日）。
- `Assignee` 使用角色占位符（BE1/BE2/DBA/DevOps/QA/TL），导入后请映射到真实成员。
- `Dependencies/Blocks` 为任务标题依赖，导入后建议在系统中改为真实Issue关联。
- Priority约定：
  - Jira: Highest=P0, High=P1
  - Linear: 1=P0, 2=P1
