# Supabase 共用名單設定

網站部署在 GitHub Pages，資料存在 Supabase。管理頁不要求登入；依照下方資料庫政策，任何訪客都能讀取、新增、修改及刪除回診紀錄。請勿在此設定下存放患者個資。

## 建立資料庫

1. 建立 Supabase 專案。
2. 開啟 SQL Editor，將 `supabase/schema.sql` 全文貼上並執行。
3. 若之後不希望名單對訪客公開，請改用有登入驗證的管理頁與限制匿名讀取的 RLS 政策。

## 設定網站連線

編輯 `supabase-config.js`：

- `url` 填 Supabase Project URL。
- `anonKey` 填 publishable key（或舊版 anon key）。

只能使用 publishable/anon key。絕不可把 `service_role` 或 `sb_secret_...` 放入瀏覽器程式碼或 GitHub。

## 發佈

將更新後的 HTML、`app.js`、`supabase-config.js`、`brand-logo.png` 與 `supabase/schema.sql` 推送到啟用 GitHub Pages 的儲存庫。

## 匯入此瀏覽器的舊資料

若這台裝置先前用過 localStorage 版本，管理頁會出現「匯入此裝置舊資料」按鈕。確認匯入後會把舊紀錄放進雲端；原始資料會保留在此裝置。每台曾經新增過紀錄的裝置都要各自匯入一次。

