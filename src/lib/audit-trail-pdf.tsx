import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#14181A" },
  title: { fontSize: 18, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 10, color: "#5B6461", marginBottom: 2 },
  generatedAt: { fontSize: 9, color: "#9AA19C", marginBottom: 22 },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 8, borderBottom: "1 solid #E4E7E5", paddingBottom: 4 },
  row: { flexDirection: "row", marginBottom: 6, paddingBottom: 6, borderBottom: "0.5 solid #F0F2F1" },
  rowWhen: { width: 118, color: "#5B6461", fontSize: 9 },
  rowMain: { flex: 1 },
  rowLabel: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  rowDetail: { fontSize: 9, color: "#5B6461", marginTop: 1 },
  empty: { fontSize: 9.5, color: "#9AA19C", fontStyle: "italic" },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, fontSize: 8.5, color: "#9AA19C", textAlign: "center" },
});

function fmt(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export type AuditEvent = { when: Date; label: string; detail?: string | null };

export function AuditTrailPdfDocument({
  clientName,
  templateName,
  workspaceName,
  generatedAt,
  events,
}: {
  clientName: string;
  templateName: string;
  workspaceName: string;
  generatedAt: Date;
  events: AuditEvent[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Audit trail</Text>
        <Text style={styles.subtitle}>{templateName} — {workspaceName} and {clientName}</Text>
        <Text style={styles.generatedAt}>Generated {fmt(generatedAt)}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Complete event history, in order</Text>
          {events.length === 0 ? (
            <Text style={styles.empty}>No events recorded yet.</Text>
          ) : (
            events.map((e, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.rowWhen}>{fmt(e.when)}</Text>
                <View style={styles.rowMain}>
                  <Text style={styles.rowLabel}>{e.label}</Text>
                  {e.detail && <Text style={styles.rowDetail}>{e.detail}</Text>}
                </View>
              </View>
            ))
          )}
        </View>

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
