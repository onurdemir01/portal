import React from 'react';
import {
  PageSection,
  Title,
  Split,
  SplitItem,
  Card,
  CardTitle,
  CardBody,
  EmptyState,
  EmptyStateBody,
  Button,
} from '@patternfly/react-core';

// İskelet: her self-servis hizmet için ekran ikiye bölünür.
//   Sol taraf  -> hizmete özel form (girişler)
//   Sağ taraf  -> Ansible job tetiklendikten sonra çıktı (poll edilerek okunur)
//                 + üretilen dosyalar için "İndir" butonları
//
// Ansible API bilgisi (base URL, job template id'leri, her hizmetin form şeması)
// verildiğinde bu iskelet gerçek hizmet ekranlarıyla doldurulacak.

function ServiceScreen({ service }) {
  return (
    <Split hasGutter>
      <SplitItem isFilled style={{ minWidth: 0, flexBasis: '40%' }}>
        <Card isFullHeight>
          <CardTitle>Girişler</CardTitle>
          <CardBody>
            {/* Hizmete özel form buraya (form_schema'dan üretilecek) */}
            <Button variant="primary" isDisabled>
              Çalıştır
            </Button>
          </CardBody>
        </Card>
      </SplitItem>
      <SplitItem isFilled style={{ minWidth: 0, flexBasis: '60%' }}>
        <Card isFullHeight>
          <CardTitle>Job Çıktısı</CardTitle>
          <CardBody>
            {/* Ansible job sonucu API ile poll edilip buraya yazılacak;
                dosya çıktıları için indirme butonları burada olacak. */}
            <EmptyState>
              <EmptyStateBody>
                Bir iş başlatıldığında çıktı ve indirilebilir dosyalar burada görünecek.
              </EmptyStateBody>
            </EmptyState>
          </CardBody>
        </Card>
      </SplitItem>
    </Split>
  );
}

export function SelfServisPage() {
  return (
    <PageSection>
      <Title headingLevel="h1">Self-Servis Hizmetler</Title>
      <div style={{ marginTop: 16 }}>
        <ServiceScreen service={null} />
      </div>
    </PageSection>
  );
}
