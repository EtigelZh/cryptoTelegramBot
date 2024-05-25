-- Кошельки с пустыми транзакциями
SELECT
 COUNT(*)
FROM (SELECT
  COUNT(t.id) trade_count,
  w.hash
FROM wallets w
LEFT JOIN transactions t ON (t.from = w.hash OR t.to = w.hash)
WHERE w.status = 'LOW_TRADES'
GROUP BY w.hash
HAVING COUNT(t.id) = 0) as empty_wallets

