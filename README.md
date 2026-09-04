
## 用户主页格式
https://www.xiaohongshu.com/user/profile/${user_id}

## 第一种分享链接
格式：https://xhslink.cn/o/7UwDYagWnyl

解析：重定向链接参数 appuid
appuid就是user_id

## 第二种分享链接
格式：https://www.xiaohongshu.com/explore/6a90261f000000002102502c?app_platform=android&ignoreEngage=true&app_version=9.44.1&share_from_user_hidden=true&xsec_source=app_share&type=normal&xsec_token=CBnrxCjHNWSsWOcy0c7VxHmIa-sBtC_7Jzkr4agsCm860=&author_share=1&xhsshare=WeixinSession&shareRedId=ODgyM0dGNkw2NzUyOTgwNjczOTc5Nz8_&apptime=1788500366&share_id=339fe35b0a5a4127b552f5f33c202aee&share_channel=wechat&code=8nb4f7yRzNr

解析：
获取 shareRedId
第一步：Base64URL 解码得到 24 字节
第二步：固定 KEY：262035496752980663974569 ，逐字符执行 r = (ord(密文字符) - KEY[i]) % 32

示例
```
ODgyM0dGNkw2NzUyOTgwNjczOTc5Nz8_
        ↓ Base64URL
8823GF6L67529806739797??
        ↓ 固定 KEY 解密
6203da2c0000000010005296

```

