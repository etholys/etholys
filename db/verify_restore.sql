SELECT 'User' AS tbl, count(*)::int AS n FROM "User"
UNION ALL SELECT 'Company', count(*)::int FROM "Company"
UNION ALL SELECT 'Project', count(*)::int FROM "Project"
UNION ALL SELECT 'Transaction', count(*)::int FROM "Transaction";
