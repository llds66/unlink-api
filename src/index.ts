import { Hono } from "hono"
import { cors } from "hono/cors"

type Bindings = CloudflareBindings & {
  CORS_ALLOW_ORIGIN?: string
}

const app = new Hono<{ Bindings: Bindings }>()

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
 * @routes 解析小红书短链 /xhs
 * @description 输入短链，跟随重定向并从 URL 中读取 appuid
 */
app.post("/xhs", async (c) => {
  const { url } = await c.req.json()

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

  try {
    // 最多跟随 5 次重定向
    for (let i = 0; i < 5; i++) {
      // 每一跳都先检查 URL 中有没有 appuid
      const appuid = currentUrl.searchParams.get("appuid")

      if (appuid) {
        return c.json({
          success: true,
          data: {
            appuid
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
      message: "未获取到 appuid",
      data: {
        appuid: null
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
