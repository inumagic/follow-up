# Supabase 共用名單設定

網站部署在 GitHub Pages，資料存在 Supabase。公開表單可以新增回診資料；管理名單必須以 Supabase Auth 帳號登入，只有已登入帳號可以讀取、修改或刪除名單。

## 建立資料庫與管理帳號

1. 在 Supabase 專案的 **Authentication → Sign In / Providers** 確認 Email 登入已啟用。
2. 在 **Authentication → Settings** 關閉公開使用者註冊（Disable sign-ups）。
3. 在 **Authentication → Users** 手動新增管理者 Email 和密碼。不要在網站程式碼裡寫入密碼。
4. 開啟 **SQL Editor**，執行 `supabase/schema.sql`。這會移除舊的公開讀取／修改政策，保留公開表單新增權限，並只讓登入帳號讀取、修改及刪除。

請勿重新開啟公開註冊。資料庫政策允許已登入的 Supabase 使用者查看名單，因此只應手動建立可信任的管理帳號。

## 設定網站連線

編輯 `supabase-config.js`：

- `url` 填 Supabase Project URL。
- `anonKey` 填 publishable key（或舊版 anon key）。

只能使用 publishable/anon key。絕不可把 `service_role` 或 `sb_secret_...` 放入瀏覽器程式碼或 GitHub。

## 發佈

將更新後的 HTML、`app.js`、`supabase-config.js`、`brand-logo.png` 與 `supabase/schema.sql` 推送到啟用 GitHub Pages 的儲存庫。部署程式碼後，仍須在 Supabase SQL Editor 執行上述 schema，資料庫才會停止公開讀取。

## 匯入此瀏覽器的舊資料

若這台裝置先前用過 localStorage 版本，管理頁登入後會出現「匯入此裝置舊資料」按鈕。確認匯入後會把舊紀錄放進雲端；原始資料會保留在此裝置。每台曾經新增過紀錄的裝置都要各自匯入一次。

