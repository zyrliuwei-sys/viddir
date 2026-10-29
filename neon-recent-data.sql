-- 在 Neon SQL Editor 里逐段运行，把结果贴回来
-- 1. 总量
select (select count(*) from "user") users,
       (select count(*) from "order") orders,
       (select count(*) from "order" where status='paid') paid_orders,
       (select count(*) from subscription) subs,
       (select count(*) from product_submission) submissions,
       (select count(*) from post) posts;

-- 2. 近 30 天每日注册
select to_char(date_trunc('day',created_at),'YYYY-MM-DD') d, count(*) n
from "user" where created_at > now()-interval '30 days' group by 1 order by 1;

-- 3. 近 30 天注册来源
select coalesce(nullif(utm_source,''),'(none)') src, nullif(locale,'') loc, count(*) n
from "user" where created_at > now()-interval '30 days' group by 1,2 order by 3 desc limit 15;

-- 4. 近 30 天订单
select to_char(created_at,'YYYY-MM-DD') d, status, product_id, amount, currency, payment_provider
from "order" where created_at > now()-interval '30 days' order by created_at desc limit 30;

-- 5. 近 30 天产品提交
select to_char(created_at,'YYYY-MM-DD') d, name, category, status
from product_submission where created_at > now()-interval '30 days' order by created_at desc limit 30;

-- 6. 近 14 天每日活跃用户（按登录 session）
select to_char(date_trunc('day',created_at),'YYYY-MM-DD') d, count(distinct user_id) n
from session where created_at > now()-interval '14 days' group by 1 order by 1;
