import React from 'react';
import {
  PageSection,
  Title,
  Tabs,
  Tab,
  TabTitleText,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  Checkbox,
  Button,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  TextArea,
  Alert,
  Spinner,
  Split,
  SplitItem,
  Panel,
  PanelMain,
  PanelMainBody,
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { api } from '../api';

// tables: [{ real_table, display_name }] — uygulama DB'sinden gelir.
// Şimdilik varsayılan listeyle çalışır; admin panelinden görünen adlar değişir.

function ResultTable({ result }) {
  if (!result) return null;
  return (
    <>
      {result.truncated && (
        <Alert
          variant="warning"
          isInline
          title="Sonuç satır limitine ulaştı; gösterilen kayıtlar kırpılmış olabilir."
          style={{ marginBottom: 12 }}
        />
      )}
      <Table aria-label="Sonuç" variant="compact">
        <Thead>
          <Tr>{result.columns.map((c) => <Th key={c}>{c}</Th>)}</Tr>
        </Thead>
        <Tbody>
          {result.rows.map((row, i) => (
            <Tr key={i}>
              {row.map((v, j) => <Td key={j}>{v === null ? '' : String(v)}</Td>)}
            </Tr>
          ))}
        </Tbody>
      </Table>
    </>
  );
}

function downloadCsv(columns, rows, filename) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [columns.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function TableBrowser({ tables }) {
  const [tableOpen, setTableOpen] = React.useState(false);
  const [table, setTable] = React.useState(tables[0]?.real_table || '');
  const [allColumns, setAllColumns] = React.useState([]);
  const [enabled, setEnabled] = React.useState({});
  const [orderBy, setOrderBy] = React.useState(null);
  const [descending, setDescending] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const loadColumns = React.useCallback(async (t) => {
    setError('');
    try {
      const { columns } = await api.inventoryColumns(t);
      setAllColumns(columns);
      setEnabled(Object.fromEntries(columns.map((c) => [c, true])));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  React.useEffect(() => { if (table) loadColumns(table); }, [table, loadColumns]);

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const cols = allColumns.filter((c) => enabled[c]);
      const res = await api.inventoryQuery(table, {
        columns: cols,
        order_by: orderBy,
        descending,
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <Select
              isOpen={tableOpen}
              selected={table}
              onSelect={(_e, v) => { setTable(v); setTableOpen(false); }}
              onOpenChange={setTableOpen}
              toggle={(ref) => (
                <MenuToggle ref={ref} onClick={() => setTableOpen((o) => !o)} isExpanded={tableOpen}>
                  {tables.find((t) => t.real_table === table)?.display_name || table}
                </MenuToggle>
              )}
            >
              <SelectList>
                {tables.map((t) => (
                  <SelectOption key={t.real_table} value={t.real_table}>
                    {t.display_name}
                  </SelectOption>
                ))}
              </SelectList>
            </Select>
          </ToolbarItem>
          <ToolbarItem>
            <Button variant="primary" onClick={run} isDisabled={loading}>
              Sorgula
            </Button>
          </ToolbarItem>
          <ToolbarItem>
            <Button
              variant="secondary"
              isDisabled={!result}
              onClick={() => downloadCsv(result.columns, result.rows, `${table}.csv`)}
            >
              CSV indir
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {allColumns.length > 0 && (
        <div style={{ margin: '12px 0', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {allColumns.map((c) => (
            <Checkbox
              key={c}
              id={`col-${c}`}
              label={c}
              isChecked={!!enabled[c]}
              onChange={(_e, v) => setEnabled((p) => ({ ...p, [c]: v }))}
            />
          ))}
        </div>
      )}

      {error && <Alert variant="danger" title={error} isInline style={{ marginBottom: 12 }} />}
      {loading ? <Spinner /> : <ResultTable result={result} />}
    </>
  );
}

function CustomQuery() {
  const [sql, setSql] = React.useState('SELECT TOP 100 * FROM Inventory');
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      setResult(await api.customQuery(sql));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Alert
        variant="info"
        isInline
        title="Yalnızca SELECT sorgularına izin verilir. Yazma/DDL komutları reddedilir."
        style={{ marginBottom: 12 }}
      />
      <TextArea
        value={sql}
        onChange={(_e, v) => setSql(v)}
        aria-label="Özel SQL sorgusu"
        rows={6}
        resizeOrientation="vertical"
        style={{ fontFamily: 'monospace' }}
      />
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <Button variant="primary" onClick={run} isDisabled={loading}>Çalıştır</Button>
        <Button
          variant="secondary"
          isDisabled={!result}
          onClick={() => downloadCsv(result.columns, result.rows, 'custom_query.csv')}
        >
          CSV indir
        </Button>
      </div>
      {error && <Alert variant="danger" title={error} isInline style={{ margin: '12px 0' }} />}
      <div style={{ marginTop: 16 }}>
        {loading ? <Spinner /> : <ResultTable result={result} />}
      </div>
    </>
  );
}

export function EnvanterlerPage({ tables }) {
  const [activeTab, setActiveTab] = React.useState(0);
  const tbl = tables && tables.length ? tables : [];

  return (
    <PageSection>
      <Title headingLevel="h1">Envanterler</Title>
      <Tabs activeKey={activeTab} onSelect={(_e, k) => setActiveTab(k)} style={{ marginTop: 12 }}>
        <Tab eventKey={0} title={<TabTitleText>Tablo Görünümü</TabTitleText>}>
          <div style={{ marginTop: 16 }}>
            {tbl.length ? <TableBrowser tables={tbl} /> : <Spinner />}
          </div>
        </Tab>
        <Tab eventKey={1} title={<TabTitleText>Özel Sorgu (Custom Query)</TabTitleText>}>
          <div style={{ marginTop: 16 }}>
            <CustomQuery />
          </div>
        </Tab>
      </Tabs>
    </PageSection>
  );
}
