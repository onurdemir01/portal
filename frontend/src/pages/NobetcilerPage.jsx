import React from 'react';
import {
  PageSection,
  Title,
  Card,
  CardTitle,
  CardBody,
  Grid,
  GridItem,
  Spinner,
  Alert,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Label,
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { api } from '../api';

function PersonCard({ title, person, variant }) {
  if (!person) return null;
  return (
    <Card isCompact>
      <CardTitle>
        {title} <Label color={variant}>Bugün</Label>
      </CardTitle>
      <CardBody>
        <DescriptionList isHorizontal>
          <DescriptionListGroup>
            <DescriptionListTerm>Ad Soyad</DescriptionListTerm>
            <DescriptionListDescription>{person.full_name}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Telefon</DescriptionListTerm>
            <DescriptionListDescription>{person.phone || '-'}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Dahili</DescriptionListTerm>
            <DescriptionListDescription>{person.intercom || '-'}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>E-posta</DescriptionListTerm>
            <DescriptionListDescription>{person.email || '-'}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Rol</DescriptionListTerm>
            <DescriptionListDescription>{person.role || '-'}</DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>
      </CardBody>
    </Card>
  );
}

const fmt = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString('tr-TR');
};

export function NobetcilerPage() {
  const [current, setCurrent] = React.useState(null);
  const [schedule, setSchedule] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    (async () => {
      try {
        const [c, s] = await Promise.all([
          api.nobetciCurrent(),
          api.nobetciSchedule(),
        ]);
        setCurrent(c.current);
        setSchedule(s.schedule || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <PageSection><Spinner /></PageSection>;

  return (
    <PageSection>
      <Title headingLevel="h1">Nöbetçiler</Title>
      {error && <Alert variant="danger" title={error} isInline style={{ marginTop: 16 }} />}

      {current ? (
        <Grid hasGutter style={{ marginTop: 16 }}>
          <GridItem md={6}>
            <PersonCard title="Asıl Nöbetçi" person={current.primary} variant="blue" />
          </GridItem>
          <GridItem md={6}>
            <PersonCard title="Yedek Nöbetçi" person={current.backup} variant="grey" />
          </GridItem>
        </Grid>
      ) : (
        <Alert variant="info" title="Şu an için aktif nöbet kaydı bulunamadı." isInline style={{ marginTop: 16 }} />
      )}

      <Title headingLevel="h2" style={{ marginTop: 32 }}>Nöbet Takvimi</Title>
      <Table aria-label="Nöbet takvimi" variant="compact" style={{ marginTop: 12 }}>
        <Thead>
          <Tr>
            <Th>Başlangıç</Th>
            <Th>Bitiş</Th>
            <Th>Asıl Nöbetçi</Th>
            <Th>Yedek Nöbetçi</Th>
          </Tr>
        </Thead>
        <Tbody>
          {schedule.map((e, i) => (
            <Tr key={i} isRowSelected={e.is_current}>
              <Td>{fmt(e.start)}</Td>
              <Td>{fmt(e.end)}</Td>
              <Td>{e.primary?.full_name || '-'}</Td>
              <Td>{e.backup?.full_name || '-'}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </PageSection>
  );
}
