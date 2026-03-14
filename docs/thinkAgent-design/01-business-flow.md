# ThinkAgent 业务流程图

## 一、系统全局业务流程

```mermaid
flowchart TB
    subgraph 用户端
        A[用户访问] --> B{已登录?}
        B -->|否| C[注册/登录]
        C --> D[首次引导设置]
        B -->|是| E[进入主应用]
        D --> E
        E --> F{选择功能}
        F --> G[智能对话]
        F --> H[知识库管理]
        F --> I[历史记录]
        F --> J[个人设置]
    end

    subgraph 管理端
        K[管理员登录] --> L{RBAC鉴权}
        L -->|通过| M[进入管理后台]
        L -->|拒绝| N[403无权限]
        M --> O{选择功能}
        O --> P[Dashboard看板]
        O --> Q[用户管理]
        O --> R[内容审核]
        O --> S[系统配置]
        O --> T[角色权限管理]
    end

    subgraph 后端服务
        G --> U[Agent引擎]
        H --> V[知识库服务]
        Q --> W[用户管控服务]
        S --> X[配置服务]
        U --> Y[(PostgreSQL)]
        V --> Y
        W --> Y
        X --> Z[(Redis)]
    end
```

---

## 二、用户注册/登录流程

```mermaid
flowchart TD
    A[用户打开应用] --> B{选择登录方式}

    B -->|手机号登录| C[输入手机号]
    C --> D[发送短信验证码]
    D --> E{验证码校验}
    E -->|失败| F[提示错误,重试]
    F --> C
    E -->|成功| G{用户是否存在?}
    G -->|否| H[自动创建账户]
    G -->|是| I[加载用户数据]
    H --> I

    B -->|微信登录| J[调用微信OAuth]
    J --> K[获取授权code]
    K --> L[服务端换取openId]
    L --> M{openId已绑定?}
    M -->|否| N[创建新用户+绑定]
    M -->|是| O[加载已有用户]
    N --> O

    I --> P[签发JWT Token]
    O --> P
    P --> Q{是否新用户?}
    Q -->|是| R[进入首次引导]
    Q -->|否| S[进入主应用]
    R --> S
```

---

## 三、智能对话核心流程

```mermaid
flowchart TD
    A[用户输入消息] --> B[消息预处理]
    B --> C{敏感词检测}
    C -->|违规| D[拦截并提示]
    C -->|通过| E{用量检查}
    E -->|超限| F[提示升级/等待]
    E -->|未超限| G[创建/获取会话Thread]

    G --> H[加载会话上下文]
    H --> I[注入用户长期记忆]
    I --> J[Agent推理引擎]

    J --> K{需要工具调用?}
    K -->|是| L[执行工具]
    L --> M{工具类型}
    M -->|联网搜索| N[Tavily API搜索]
    M -->|知识库检索| O[pgvector向量检索]
    M -->|内容生成| P[结构化内容生成]
    M -->|数据分析| Q[数据分析处理]
    N --> R[工具结果返回Agent]
    O --> R
    P --> R
    Q --> R
    R --> J

    K -->|否| S[生成最终回复]
    S --> T[流式输出SSE]
    T --> U[保存对话记录]
    U --> V[更新用户记忆]
    V --> W[增加用量计数]
```

---

## 四、知识库文档处理流程

```mermaid
flowchart TD
    A[用户上传文档] --> B{文件格式校验}
    B -->|不支持| C[返回错误提示]
    B -->|通过| D{文件大小校验}
    D -->|超限| E[返回大小超限提示]
    D -->|通过| F[上传到OSS]
    F --> G[创建Document记录,status=PROCESSING]
    G --> H[推入BullMQ任务队列]

    H --> I[Worker消费任务]
    I --> J[从OSS下载文件]
    J --> K{文件格式}
    K -->|PDF| L[pdf-parse解析]
    K -->|Word| M[mammoth解析]
    K -->|Markdown| N[直接解析]
    K -->|TXT| O[直接读取]
    K -->|URL| P[Cheerio爬取]

    L --> Q[提取纯文本]
    M --> Q
    N --> Q
    O --> Q
    P --> Q

    Q --> R[RecursiveCharacterTextSplitter分块]
    R --> S[text-embedding-3-small向量化]
    S --> T[批量写入pgvector]
    T --> U[更新Document status=READY]

    I --> V{处理失败?}
    V -->|是| W[更新status=FAILED,记录错误]
    V -->|否| U
```

---

## 五、RAG 知识库检索问答流程

```mermaid
flowchart TD
    A[用户提问] --> B[Agent分析意图]
    B --> C{需要知识库检索?}
    C -->|否| D[直接生成回复]
    C -->|是| E[调用knowledge_base_search工具]
    E --> F[将问题向量化 embedding]
    F --> G[pgvector余弦相似度搜索]
    G --> H[返回Top-K相关文档块]
    H --> I{相似度 > 0.75?}
    I -->|无结果| J[告知用户知识库无相关内容]
    I -->|有结果| K[将检索结果注入Agent上下文]
    K --> L[Agent结合检索结果生成回复]
    L --> M[回复中标注引用来源]
    M --> N[流式输出给用户]
```

---

## 六、管理员登录与 RBAC 鉴权流程

```mermaid
flowchart TD
    A[管理员打开后台] --> B[输入用户名+密码]
    B --> C{账户是否被锁定?}
    C -->|是| D[提示账户锁定,稍后重试]
    C -->|否| E{密码校验}
    E -->|失败| F[失败计数+1]
    F --> G{失败次数>=5?}
    G -->|是| H[锁定账户30分钟]
    G -->|否| I[提示用户名或密码错误]
    H --> D
    E -->|成功| J[重置失败计数]
    J --> K[签发Admin JWT Token]
    K --> L[查询管理员角色列表]
    L --> M[聚合角色下所有权限]
    M --> N[缓存权限到Redis]
    N --> O[返回Token+权限+菜单]
    O --> P[前端动态生成路由和菜单]
```

---

## 七、管理员操作权限校验流程

```mermaid
flowchart TD
    A[管理员发起API请求] --> B[adminAuthMiddleware]
    B --> C{JWT Token有效?}
    C -->|无效/过期| D[返回401未认证]
    C -->|有效| E[解析adminId]
    E --> F[requirePermission中间件]
    F --> G{Redis缓存有权限数据?}
    G -->|是| H[使用缓存权限]
    G -->|否| I[查询DB角色-权限关联]
    I --> J[写入Redis缓存 TTL=10min]
    J --> H
    H --> K{权限集合包含所需权限?}
    K -->|否| L[返回403权限不足]
    K -->|是| M[执行业务逻辑]
    M --> N[auditLogger中间件]
    N --> O[写入审计日志]
    O --> P[返回响应]
```

---

## 八、用户使用控制流程（管理端配额管理）

```mermaid
flowchart TD
    A[用户发起请求] --> B[rateLimitMiddleware]
    B --> C{查询用户配额覆盖 Redis}
    C -->|有覆盖| D[使用自定义配额]
    C -->|无覆盖| E{查询全局默认配额 Redis}
    E --> F[使用默认配额]
    D --> G{检查用量是否超限}
    F --> G
    G -->|未超限| H[放行请求]
    G -->|超限| I{用户等级?}
    I -->|免费| J[返回429 + 升级引导]
    I -->|Pro| K[返回429 + 稍后重试]
    H --> L[增加用量计数器]

    subgraph 管理员操作
        M[管理员修改全局配额] --> N[更新SystemConfig表]
        N --> O[同步Redis缓存]
        O --> P[Redis Pub/Sub通知各实例]

        Q[管理员设置用户自定义配额] --> R[更新UserQuotaOverride表]
        R --> S[清除该用户Redis配额缓存]

        T[管理员重置用户用量] --> U[清零Redis计数器]
    end
```

---

## 九、内容审核流程

```mermaid
flowchart TD
    A[用户消息/AI回复] --> B[contentFilterMiddleware]
    B --> C{自动检测结果}
    C -->|置信度>=0.9 明确违规| D[自动拦截,不返回用户]
    D --> E[记录到ContentFlag表]
    C -->|0.6<=置信度<0.9 疑似违规| F[正常返回用户]
    F --> G[推入人工审核队列]
    G --> H[ContentFlag status=PENDING]
    C -->|置信度<0.6 正常| I[正常返回用户]

    subgraph 人工审核(管理后台)
        H --> J[审核员查看审核队列]
        J --> K{审核结论}
        K -->|通过| L[标记APPROVED]
        K -->|违规-仅删除| M[删除内容]
        K -->|违规-删除+警告| N[删除内容 + 警告用户]
        K -->|违规-删除+封禁| O[删除内容 + 禁用用户账户]
    end
```

---

## 十、订阅与付费流程

```mermaid
flowchart TD
    A[用户点击升级Pro] --> B{选择支付方式}
    B -->|微信支付| C[创建微信支付订单]
    B -->|支付宝| D[创建支付宝订单]
    C --> E[返回支付参数]
    D --> E
    E --> F[前端调起支付]
    F --> G{支付结果}
    G -->|成功| H[支付回调通知]
    H --> I[验证签名]
    I --> J[更新订单状态=PAID]
    J --> K[升级用户tier=PRO]
    K --> L[设置订阅到期时间]
    L --> M[清除Redis用户缓存]
    M --> N[通知用户升级成功]
    G -->|失败| O[提示支付失败]
    G -->|取消| P[保持当前等级]

    subgraph 自动续费
        Q[定时任务: 每日检查到期订阅] --> R{用户开启自动续费?}
        R -->|是| S[发起自动扣款]
        S --> T{扣款成功?}
        T -->|是| U[延长订阅期限]
        T -->|否| V[通知用户续费失败]
        R -->|否| W{订阅是否到期?}
        W -->|是| X[降级为Free]
        W -->|否| Y[无操作]
    end
```

---

## 十一、系统配置热加载流程

```mermaid
flowchart LR
    A[管理员修改配置] --> B[写入PostgreSQL system_configs表]
    B --> C[同步更新Redis缓存]
    C --> D[发布Redis Pub/Sub消息]
    D --> E[服务实例A收到通知]
    D --> F[服务实例B收到通知]
    D --> G[服务实例N收到通知]
    E --> H[重新加载内存配置]
    F --> H
    G --> H
    H --> I[新配置立即生效,无需重启]
```

---

## 十二、完整用户旅程业务流程

```mermaid
flowchart TD
    START([开始]) --> A[用户访问ThinkAgent]
    A --> B{已注册?}
    B -->|否| C[手机号/微信注册]
    B -->|是| D[登录]
    C --> E[首次引导]
    E --> E1[设置职业]
    E1 --> E2[选择AI风格偏好]
    E2 --> E3[可选:创建知识库]
    E3 --> E4[体验示例对话]
    D --> F[进入主界面]
    E4 --> F

    F --> G{用户操作}

    G -->|对话| H[新建/继续对话]
    H --> H1[输入文本/上传图片]
    H1 --> H2[Agent处理+流式回复]
    H2 --> H3{满意?}
    H3 -->|是| H4[点赞/收藏]
    H3 -->|否| H5[点踩/继续追问]
    H4 --> G
    H5 --> G

    G -->|知识库| I[知识库管理]
    I --> I1[上传文档/导入URL]
    I1 --> I2[等待解析完成]
    I2 --> I3[在对话中引用]
    I3 --> G

    G -->|设置| J[个人设置]
    J --> J1[修改偏好/AI风格]
    J1 --> G

    G -->|升级| K[付费升级]
    K --> K1[选择套餐]
    K1 --> K2[完成支付]
    K2 --> K3[解锁Pro功能]
    K3 --> G

    G -->|退出| END([结束])
```
