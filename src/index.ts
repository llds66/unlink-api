import { Hono } from "hono"
import { cors } from "hono/cors"

type Bindings = CloudflareBindings & {
  CORS_ALLOW_ORIGIN?: string
}

const app = new Hono<{ Bindings: Bindings }>()

const SHARE_RED_ID_KEY = "262035496752980663974569"

/**
 * 从第二种分享链接的 shareRedId 参数还原用户 ID。
 * shareRedId 使用 Base64URL 编码，解码后再按固定密钥逐字符模 32 相减。
 */
function decodeShareRedId(shareRedId: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(shareRedId)) {
    return null
  }

  try {
    const padded = shareRedId
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(shareRedId.length / 4) * 4, "=")
    const encrypted = atob(padded)

    if (encrypted.length !== SHARE_RED_ID_KEY.length) {
      return null
    }

    const appuid = Array.from(encrypted, (character, index) => {
      const residue = (character.charCodeAt(0) - Number(SHARE_RED_ID_KEY[index]) + 32) % 32

      // appuid 为十六进制字符串；模 32 的余数需映射回对应的可打印字符。
      if (residue >= 16 && residue <= 25) {
        return String.fromCharCode(residue + 32)
      }

      if (residue >= 1 && residue <= 6) {
        return String.fromCharCode(residue + 96)
      }

      return null
    })

    return appuid.every((character) => character !== null) ? appuid.join("") : null
  } catch {
    return null
  }
}

/** 跨域配置 */
app.use("*", (c, next) => {
  const allowedOrigins = (c.env.CORS_ALLOW_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)

  return cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : undefined),
    allowHeaders: ["Content-Type"],
    allowMethods: ["GET", "POST"]
  })(c, next)
})

app.get("/", (c) => {
  return c.text("UnLink Serve Success!")
})

/**
 * @routes 解析小红书分享链接 /xhs
 * @description 支持短链重定向中的 appuid，以及长链接 shareRedId
 */
app.post("/xhs", async (c) => {
  const { url, turnstileToken } = await c.req.json()

  if (!url) {
    return c.json(
      {
        success: false,
        message: "url 不能为空"
      },
      400
    )
  }

  let currentUrl: URL

  try {
    currentUrl = new URL(url)
  } catch {
    return c.json(
      {
        success: false,
        message: "url 格式错误"
      },
      400
    )
  }

  // 只允许小红书相关域名，防止 SSRF
  const allowedHosts = ["xhslink.cn", "www.xiaohongshu.com", "xiaohongshu.com"]

  if (currentUrl.protocol !== "https:" || !allowedHosts.includes(currentUrl.hostname)) {
    return c.json(
      {
        success: false,
        message: "仅支持小红书链接"
      },
      400
    )
  }


  // 验证 Turnstile
  if (!turnstileToken) {
    return c.json(
      {
        success: false,
        message: "请完成人机验证"
      },
      400
    )
  }
  const formData = new FormData()
  formData.append(
    "secret",
    c.env.TURNSTILE_SECRET_KEY
  )

  formData.append(
    "response",
    turnstileToken
  )

  const ip = c.req.header("CF-Connecting-IP")

  if (ip) {
    formData.append("remoteip", ip)
  }

  const verifyResponse = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: formData
    }
  )
  if (!verifyResponse.ok) {
    console.error(
      "Turnstile Siteverify 请求失败:",
      verifyResponse.status
    )

    return c.json(
      {
        success: false,
        message: "人机验证服务异常"
      },
      502
    )
  }

  const verifyResult = await verifyResponse.json<{
    success: boolean
    "error-codes"?: string[]
  }>()

  if (!verifyResult.success) {
    return c.json(
      {
        success: false,
        message: "人机验证失败"
      },
      400
    )
  }



  try {
    // 最多跟随 5 次重定向
    for (let i = 0; i < 5; i++) {
      // 每一跳都先检查第一种分享格式的 appuid
      const appuid = currentUrl.searchParams.get("appuid")

      if (appuid) {
        return c.json({
          success: true,
          data: {
            user_id: appuid
          }
        })
      }

      // 第二种分享格式将用户 ID 加密后放在 shareRedId 中，无需请求页面。
      const shareRedId = currentUrl.searchParams.get("shareRedId")
      const decodedAppuid = shareRedId ? decodeShareRedId(shareRedId) : null

      if (decodedAppuid) {
        return c.json({
          success: true,
          data: {
            user_id: decodedAppuid
          }
        })
      }

      const res = await fetch(currentUrl.toString(), {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36"
        }
      })

      const location = res.headers.get("location")

      // 没有重定向了
      if (!location) {
        break
      }

      const nextUrl = new URL(location, currentUrl)

      // 防止重定向到其他任意网站
      if (nextUrl.protocol !== "https:" || !allowedHosts.includes(nextUrl.hostname)) {
        return c.json(
          {
            success: false,
            message: "重定向到了非小红书域名"
          },
          400
        )
      }

      currentUrl = nextUrl
    }

    return c.json({
      success: true,
      message: "未获取到 user_id",
      data: {
        user_id: null
      }
    })
  } catch (error) {
    console.error("解析小红书链接失败:", error)

    return c.json(
      {
        success: false,
        message: "链接解析失败"
      },
      500
    )
  }
})

export default app
