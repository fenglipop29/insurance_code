# 埋点事件字典（v1）

更新时间：2026-02-27

## 统一上报接口

- Endpoint: `POST /api/track/events`
- Body:
  - `event`: 事件名（必填）
  - `properties`: 事件属性（可选，JSON对象）
- Header（前端自动带）:
  - `x-client-source`: 端标识（`c-web` / `b-web` / `p-web`）
  - `x-client-path`: 当前页面路径

## C端事件

- `c_page_view`
  - 触发：Tab切换后
  - properties：`tab`、`authed`
- `c_auth_verified`
  - 触发：基础实名成功
  - properties：`userId`
- `c_click_points_mall`
  - 触发：打开积分商城
  - properties：`fromTab`
- `c_click_advisor_detail`
  - 触发：打开顾问详情
  - properties：`fromTab`
- `c_sign_in_success`
  - 触发：签到成功
  - properties：`reward`、`balance`
- `c_sign_in_repeat`
  - 触发：重复签到
  - properties：空对象
- `c_sign_in_failed`
  - 触发：签到失败
  - properties：`code`
- `c_share_success`
  - 触发：C端客户分享成功（系统分享/复制链接均计入）
  - properties：`tab`、`method`

## B端事件

- `b_login_success`
  - 触发：登录成功
  - properties：空对象
- `b_page_view`
  - 触发：底部Tab切换后
  - properties：`tab`
- `b_tools_share_success`
  - 触发：B端客户分享成功（内容/活动/商品/积分活动）
  - properties：`kind`、`sharePath`、`shareMethod`

## P端事件

- `p_page_view`
  - 触发：左侧菜单视图切换后
  - properties：`view`

## 存储

- 内存态字段：`trackEvents`
- PostgreSQL表：`p_track_events`
