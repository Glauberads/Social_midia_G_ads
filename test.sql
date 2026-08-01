CREATE TABLE IF NOT EXISTS test_rls (id int, val text);
ALTER TABLE test_rls ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_rls FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS test_rls_policy ON test_rls;
CREATE POLICY test_rls_policy ON test_rls USING (false);
INSERT INTO test_rls VALUES (1, 'a');
-- We can't see SELECT output from db execute easily, but we can verify if INSERT fails or passes.
