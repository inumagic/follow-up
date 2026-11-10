# Supabase 共用名單設定

網站部署在 GitHub Pages，資料存在 Supabase。只有登入且列在 `followup_staff` 名單中的人員，才能讀取、建立或更新患者回診資料。

## 建立資料庫

1. 建立 Supabase 專案。
2. 開啟 SQL Editor，將 `supabase/schema.sql` 全文貼上並執行。
3. 確認 `followup_records` 與 `followup_staff` 都已啟用 Row Level Security。資料表政策已限制匿名使用者，只有核准人員可存取。

## 建立人員帳號與授權

1. 在 Authentication 設定中關閉公開註冊。
2. 從 Authentication → Users 建立或邀請診所人員帳號。
3. 在 SQL Editor 將每位核准人員加入允許名單，將下列 email 換成該人員的登入 email：

```sql
insert into public.followup_staff (user_id)
select id from auth.users where email = 'staff@example.com'
on conflict (user_id) do nothing;
```

人員需用上述帳號登入各裝置。未加入 `followup_staff` 的登入帳號仍無法讀取患者資料。

## 設定網站連線

編輯 `supabase-config.js`：

- `url` 填 Supabase Project URL。
- `anonKey` 填 publishable key（或舊版 anon key）。

只能使用 publishable/anon key。絕不可把 `service_role` 或 `sb_secret_...` 放入瀏覽器程式碼或 GitHub。

## 發佈

將更新後的 HTML、`app.js`、`supabase-config.js`、`brand-logo.png` 與 `supabase/schema.sql` 推送到啟用 GitHub Pages 的 `inumagic/follow-up` 儲存庫。部署完成後，所有已授權人員會看到同一份名單。

## 匯入此瀏覽器的舊資料

若這台裝置先前用過 localStorage 版本，登入管理頁後會出現「匯入此裝置舊資料」按鈕。確認匯入後會把舊紀錄放進雲端；原始資料會保留在此裝置。每台曾經新增過紀錄的裝置都要各自匯入一次。

