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
  Split,
  SplitItem,
} from '@patternfly/react-core';
import { api } from '../api';

// Hava durumu ikon anahtarı -> emoji (basit, bağımlılıksız)
const WEATHER_EMOJI = {
  clear: '☀️',
  'mostly-clear': '🌤️',
  'partly-cloudy': '⛅',
  cloudy: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  rain: '🌧️',
  showers: '🌦️',
  snow: '❄️',
  thunder: '⛈️',
  unknown: '❓',
};

function NobetciPerson({ title, person, color, showPhoto }) {
  if (!person) return null;
  // Fotoğraf sadece Asıl Nöbetçi'de ve sicil no varsa gösterilir.
  const [photoOk, setPhotoOk] = React.useState(true);
  const showImg = showPhoto && person.email && photoOk;
  return (
    <Card isCompact isFullHeight>
      <CardTitle>
        {title} <Label color={color}>Bugün</Label>
      </CardTitle>
      <CardBody>
        <Split hasGutter>
          {showImg && (
            <SplitItem>
              <img
                src={api.photoUrlByEmail(person.email)}
                alt={person.full_name}
                onError={() => setPhotoOk(false)}
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--pf-v5-global--BorderColor--100)',
                }}
              />
            </SplitItem>
          )}
          <SplitItem isFilled>
            <DescriptionList isCompact>
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
            </DescriptionList>
          </SplitItem>
        </Split>
      </CardBody>
    </Card>
  );
}

function WeatherCard({ city }) {
  const emoji = WEATHER_EMOJI[city.icon] || WEATHER_EMOJI.unknown;
  return (
    <Card isCompact isFullHeight>
      <CardBody>
        <Split hasGutter style={{ alignItems: 'center' }}>
          <SplitItem>
            <span style={{ fontSize: 40, lineHeight: 1 }}>{emoji}</span>
          </SplitItem>
          <SplitItem isFilled>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{city.name}</div>
            <div style={{ fontSize: 13, color: 'var(--pf-v5-global--Color--200)' }}>
              {city.description}
            </div>
          </SplitItem>
          <SplitItem>
            <div style={{ fontSize: 26, fontWeight: 700 }}>
              {city.temperature != null ? `${Math.round(city.temperature)}°` : '—'}
            </div>
            {city.wind != null && (
              <div style={{ fontSize: 11, color: 'var(--pf-v5-global--Color--200)', textAlign: 'right' }}>
                {Math.round(city.wind)} km/s
              </div>
            )}
          </SplitItem>
        </Split>
      </CardBody>
    </Card>
  );
}

export function AnasayfaPage() {
  const [current, setCurrent] = React.useState(null);
  const [nobetciErr, setNobetciErr] = React.useState('');
  const [cities, setCities] = React.useState(null);
  const [weatherErr, setWeatherErr] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      // İki veri bağımsız — biri hata verse diğeri gelsin
      const [n, w] = await Promise.allSettled([
        api.nobetciCurrent(),
        api.weather(),
      ]);
      if (n.status === 'fulfilled') setCurrent(n.value.current);
      else setNobetciErr(n.reason?.message || 'Nöbetçi bilgisi alınamadı.');
      if (w.status === 'fulfilled') setCities(w.value.cities);
      else setWeatherErr(w.reason?.message || 'Hava durumu alınamadı.');
      setLoading(false);
    })();
  }, []);

  if (loading) return <PageSection><Spinner /></PageSection>;

  return (
    <PageSection>
      <Title headingLevel="h1">Anasayfa</Title>

      {/* Günün nöbetçisi */}
      <Title headingLevel="h2" style={{ marginTop: 20, marginBottom: 12 }}>
        Günün Nöbetçisi
      </Title>
      {nobetciErr && <Alert variant="warning" title={nobetciErr} isInline style={{ marginBottom: 12 }} />}
      {current ? (
        <Grid hasGutter>
          <GridItem md={6}>
            <NobetciPerson title="Asıl Nöbetçi" person={current.primary} color="blue" showPhoto />
          </GridItem>
          <GridItem md={6}>
            <NobetciPerson title="Yedek Nöbetçi" person={current.backup} color="grey" />
          </GridItem>
        </Grid>
      ) : (
        !nobetciErr && <Alert variant="info" title="Şu an için aktif nöbet kaydı bulunamadı." isInline />
      )}

      {/* Hava durumu */}
      <Title headingLevel="h2" style={{ marginTop: 32, marginBottom: 12 }}>
        Hava Durumu
      </Title>
      {weatherErr && <Alert variant="warning" title={weatherErr} isInline style={{ marginBottom: 12 }} />}
      {cities && (
        <Grid hasGutter>
          {cities.map((c) => (
            <GridItem key={c.name} sm={12} md={6} lg={4} xl2={2}>
              <WeatherCard city={c} />
            </GridItem>
          ))}
        </Grid>
      )}
    </PageSection>
  );
}
