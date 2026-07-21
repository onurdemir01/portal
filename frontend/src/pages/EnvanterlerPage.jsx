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
  TextInput,
  Alert,
  Spinner,
  Pagination,
  Popover,
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { api } from '../api';

const scrollBoxStyle = {
  overflowX: 'auto',
  width: '100%',
  border: '1px solid var(--pf-v5-global--BorderColor--100)',
};
const nowrapCell = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '360px',
};

function downloadCsv(columns, rows, filename) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [columns.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Sonuç tablosu: kolon başlığında istemci-taraflı filtre + pagination.
// colFilters: her kolon için yazılan metin; satırlar bunlara göre (VE) süzülür.
function ResultTable({ result, visibleColumns, enableColumnFilters = true }) {
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(100);
  const [colFilters, setColFilters] = React.useState({});

  React.useEffect(() => { setPage(1); setColFilters({}); }, [result]);

  if (!result) return null;

  const cols = visibleColumns || result.columns;
  const colIndex = cols.map((c) => result.columns.indexOf(c));

  // İstemci tarafı filtre: yüklü satırlar içinde, tüm aktif kolon filtreleri VE.
  const activeFilters = Object.entries(colFilters).filter(([, v]) => v && v.trim());
  const filteredRows = activeFilters.length === 0
    ? result.rows
    : result.rows.filter((row) =>
        activeFilters.every(([col, term]) => {
          const ci = result.columns.indexOf(col);
          const cell = row[ci];
          return cell != null && String(cell).toLowerCase().includes(term.toLowerCase());
        })
      );

  const start = (page - 1) * perPage;
  const pageRows = filteredRows.slice(start, start + perPage);

  return (
    <>
      {result.truncated && (
        <Alert
          variant="warning"
          isInline
          title={`Sonuç ${result.row_count} satırla sınırlandı. Tamamını görmek için yukarıdaki sunucu aramasını kullanın.`}
          style={{ marginBottom: 12 }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, color: 'var(--pf-v5-global--Color--200)' }}>
          {activeFilters.length > 0
            ? `${filteredRows.length} / ${result.rows.length} satır (filtreli)`
            : `${result.rows.length} satır`}
        </span>
        <Pagination
          itemCount={filteredRows.length}
          perPage={perPage}
          page={page}
          perPageOptions={[
            { title: '50', value: 50 },
            { title: '100', value: 100 },
            { title: '250', value: 250 },
            { title: '500', value: 500 },
          ]}
          onSetPage={(_e, p) => setPage(p)}
          onPerPageSelect={(_e, v) => { setPerPage(v); setPage(1); }}
          isCompact
        />
      </div>

      <div style={scrollBoxStyle}>
        <Table aria-label="Sonuç" variant="compact" gridBreakPoint="">
          <Thead>
            <Tr>
              {cols.map((c) => (
                <Th key={c} style={{ whiteSpace: 'nowrap' }}>{c}</Th>
              ))}
            </Tr>
            {enableColumnFilters && (
              <Tr>
                {cols.map((c) => (
                  <Th key={c} style={{ padding: '4px 8px' }}>
                    <TextInput
                      value={colFilters[c] || ''}
                      onChange={(_e, v) => { setColFilters((p) => ({ ...p, [c]: v })); setPage(1); }}
                      aria-label={`${c} filtrele`}
                      placeholder="filtre…"
                      style={{ minWidth: 90, fontSize: 12, height: 26 }}
                    />
                  </Th>
                ))}
              </Tr>
            )}
          </Thead>
          <Tbody>
            {pageRows.map((row, i) => (
              <Tr key={start + i}>
                {colIndex.map((ci, j) => {
                  const v = row[ci];
                  const text = v === null || v === undefined ? '' : String(v);
                  return (
                    <Td key={j} style={nowrapCell} title={text}>{text}</Td>
                  );
                })}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>

      <Pagination
        itemCount={filteredRows.length}
        perPage={perPage}
        page={page}
        onSetPage={(_e, p) => setPage(p)}
        onPerPageSelect={(_e, v) => { setPerPage(v); setPage(1); }}
        variant="bottom"
        isCompact
      />
    </>
  );
}

function TableBrowser({ tables }) {
  const [tableOpen, setTableOpen] = React.useState(false);
  const [table, setTable] = React.useState(tables[0]?.real_table || '');
  const [allColumns, setAllColumns] = React.useState([]);
  const [enabled, setEnabled] = React.useState({});
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const loadTable = React.useCallback(async (t, filters = null) => {
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const { columns } = await api.inventoryColumns(t);
      setAllColumns(columns);
      setEnabled(Object.fromEntries(columns.map((c) => [c, true])));
      const res = await api.inventoryQuery(t, { columns: null, filters });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (table) loadTable(table);
  }, [table, loadTable]);

  const visibleColumns = allColumns.filter((c) => enabled[c]);

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
            <Popover
              hasAutoWidth
              bodyContent={
                <div style={{ maxHeight: 320, overflowY: 'auto', minWidth: 220 }}>
                  <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
                    <Button variant="link" isInline onClick={() =>
                      setEnabled(Object.fromEntries(allColumns.map((c) => [c, true])))
                    }>Tümünü seç</Button>
                    <Button variant="link" isInline onClick={() =>
                      setEnabled(Object.fromEntries(allColumns.map((c) => [c, false])))
                    }>Temizle</Button>
                  </div>
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
              }
            >
              <Button variant="secondary">
                Kolonlar ({visibleColumns.length}/{allColumns.length})
              </Button>
            </Popover>
          </ToolbarItem>

          <ToolbarItem>
            <Button
              variant="secondary"
              isDisabled={!result}
              onClick={() => downloadCsv(
                visibleColumns,
                result.rows.map((r) => visibleColumns.map((c) => r[result.columns.indexOf(c)])),
                `${table}.csv`,
              )}
            >
              CSV indir
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {error && <Alert variant="danger" title={error} isInline style={{ marginBottom: 12 }} />}
      {loading ? <Spinner /> : <ResultTable result={result} visibleColumns={visibleColumns} />}
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
