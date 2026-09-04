## 接口

### `POST /xhs`

解析小红书分享链接中的用户 ID，支持短链接重定向后的 `appuid` 参数，以及长链接中的 `shareRedId` 参数。

请求头：

| 名称 | 值 |
| --- | --- |
| `Content-Type` | `application/json` |

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `url` | `string` | 是 | HTTPS 小红书链接；仅支持 `xhslink.cn`、`xiaohongshu.com` 和 `www.xiaohongshu.com`。 |


解析成功：

```json
{
  "success": true,
  "data": {
    "user_id": "0123456789abcdef"
  }
}
```

未能从合法链接中取得用户 ID 时，接口仍返回 `200`：

```json
{
  "success": true,
  "message": "未获取到 user_id",
  "data": {
    "user_id": null
  }
}
```

参数错误或不支持的链接返回 `400`：

```json
{
  "success": false,
  "message": "url 不能为空"
}
```

## 检测原理

### 普通分享短链接

短链接通常会经由 302/301 重定向，获取 URL 的查询参数的`appuid`(用户ID)

### 微信分享链接

获取链接中的 `shareRedId`参数
+ Base64URL 转回普通 Base64 并补齐 =
+ atob 解码得到加密字符；
+ 用固定密钥 262035496752980663974569 对每个字符做模 32 相减；
+ 把余数映射回十六进制字符，得到原始 用户ID。

## 致谢

- 解密方法参考 [LuckyXing](https://linux.do/t/topic/2809994)

- [**LINUX DO 社区**](https://linux.do) (真诚 、友善 、团结 、专业)
