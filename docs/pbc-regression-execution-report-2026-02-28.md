# P/B/C 回归执行报告（按两份测试文档）

执行日期：2026-02-28  
执行基线：
- `./pbc-regression-test-plan-v1.md`
- `./pbc-regression-test-plan-v2-data-permission.md`

执行环境：
- API: `http://127.0.0.1:4000`
- P端: `http://127.0.0.1:3002`
- B端: `http://127.0.0.1:3001`
- C端: `http://127.0.0.1:3000`

执行方式：
- API自动化：`../scripts/pbc_regression_runner_20260228.mjs`
- 浏览器自动化（Playwright，真实页面）：P/B/C 三端登录与关键操作

## 总结
- 总用例：20
- 通过：19
- 失败：1
- 通过率：95.0%

## 浏览器验证（已通过）
- `BROWSER-P-001` P端团队主管可进入“新建活动”（无权限弹窗未出现）
- `BROWSER-B-001` B端业务员登录后页面可用
- `BROWSER-C-001` C端“知识学习”页可进入

截图证据：
- `/tmp/reg_p_teamlead_create_activity.png`
- `/tmp/reg_b_agent_profile.png`
- `/tmp/reg_c_learning.png`

## 关键用例结果（覆盖两份文档核心P0/P1）
- `REG-P-001` P端平台管理员登录：通过
- `REG-P-004` P端租户员工登录：通过
- `REG-B-001` B端员工登录：通过
- `DP-AUTH-001` 租户隔离（platform/company）：通过
- `DP-AUTH-002` agent 数据范围：通过
- `DP-AUTH-003` team_lead 数据范围：通过
- `DP-AUTH-004` 跨租户越权防护：通过（403）
- `DP-EVT-006` C/B 分享分端统计：通过
- `DP-MET-001/002` 登录/签到天数指标存在：通过
- `DP-TAG-001` 固定值规则输出：通过（outputValue=`高价值`）
- `DP-TAG-002` 映射值规则输出：通过（outputValue=`低意向`）
- `DP-TAG-005` 标签删除保护：通过（`TAG_IN_USE`）
- `REG-C-001` C端实名登录：通过
- `REG-C-004` C端签到：通过
- `DP-PTS-001/002` 签到发分+流水记录：通过

## 失败项
- `REG-C-005` C端商城兑换成功：失败
  - 现象：`POST /api/mall/redeem` 返回 500
  - 关联现状：当前 C 端客户所在租户无可兑换商品可见（列表为空），导致兑换链路无法完成。

## 原始结果文件
- `/tmp/pbc_regression_results_20260228.json`
- `/tmp/pbc_regression_results_20260228_pretty.json`

