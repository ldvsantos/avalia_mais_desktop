// ============================================================
// ReportService — Geração de PDFs e Relatórios
// ============================================================
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

class ReportService {
  constructor(db) {
    this.db = db;
  }

  async generateSubmissionPDF(protocol) {
    const submission = this.db.db.prepare('SELECT * FROM submissions WHERE protocol = ?').get(protocol);
    if (!submission) throw new Error('Inscrição não encontrada');

    const settings = this.db.getSettings();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text('COMPROVANTE DE INSCRIÇÃO', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica').text(settings['app.institution'] || 'Avalia+ Desktop', { align: 'center' });
      doc.moveDown();

      // Linha separadora
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#1e40af');
      doc.moveDown();

      // Dados
      doc.fontSize(11).font('Helvetica-Bold').text('Protocolo: ', { continued: true });
      doc.font('Helvetica').text(submission.protocol);

      doc.font('Helvetica-Bold').text('Hash de Verificação: ', { continued: true });
      doc.font('Helvetica').fontSize(8).text(submission.hash);
      doc.fontSize(11);

      doc.moveDown();
      doc.font('Helvetica-Bold').text('Data de Inscrição: ', { continued: true });
      doc.font('Helvetica').text(new Date(submission.created_at).toLocaleString('pt-BR'));

      doc.moveDown();
      doc.font('Helvetica-Bold').text('Candidato: ', { continued: true });
      doc.font('Helvetica').text(submission.nome);

      if (submission.email) {
        doc.font('Helvetica-Bold').text('E-mail: ', { continued: true });
        doc.font('Helvetica').text(submission.email);
      }

      doc.moveDown();
      doc.font('Helvetica-Bold').text('Projeto: ', { continued: true });
      doc.font('Helvetica').text(submission.titulo_pt || 'N/A');

      doc.font('Helvetica-Bold').text('Linha de Pesquisa: ', { continued: true });
      doc.font('Helvetica').text(submission.linha_pesquisa || 'N/A');

      doc.moveDown();
      doc.font('Helvetica-Bold').text('Status: ', { continued: true });
      doc.font('Helvetica').text(submission.status);

      // Rodapé
      doc.moveDown(3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#1e40af');
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#666').text('Documento gerado pelo Avalia+ Desktop em ' + new Date().toLocaleString('pt-BR'), { align: 'center' });
      doc.text('Este documento pode ser verificado através do protocolo e hash acima.', { align: 'center' });

      doc.end();
    });
  }

  async generateAllocationPDF(data) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const settings = this.db.getSettings();

      doc.fontSize(16).font('Helvetica-Bold').text('RELATÓRIO DE ALOCAÇÃO DE VAGAS', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(settings['app.institution'] || '', { align: 'center' });
      doc.moveDown();

      for (const [line, candidates] of Object.entries(data.allocation || {})) {
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e40af').text(`Linha: ${line}`);
        doc.fillColor('#000');
        doc.moveDown(0.3);

        // Tabela
        const headers = ['#', 'Nome', 'Nota Final', 'Projeto', 'Entrevista', 'Língua', 'Tipo Vaga'];
        const colWidths = [30, 200, 70, 70, 70, 70, 100];
        let x = 40;
        const y = doc.y;

        doc.fontSize(9).font('Helvetica-Bold');
        headers.forEach((h, i) => {
          doc.text(h, x, y, { width: colWidths[i], align: 'center' });
          x += colWidths[i];
        });
        doc.moveDown(0.5);
        doc.moveTo(40, doc.y).lineTo(670, doc.y).stroke();
        doc.moveDown(0.3);

        doc.font('Helvetica').fontSize(9);
        candidates.forEach((c, idx) => {
          x = 40;
          const row = doc.y;
          const vals = [
            String(idx + 1),
            c.nome || '',
            String(c.notaFinal || ''),
            String(c.media_projeto ? c.media_projeto.toFixed(2) : '-'),
            String(c.media_entrevista ? c.media_entrevista.toFixed(2) : '-'),
            String(c.media_lingua ? c.media_lingua.toFixed(2) : '-'),
            c.tipoVaga || ''
          ];
          vals.forEach((v, i) => {
            doc.text(v, x, row, { width: colWidths[i], align: i === 1 ? 'left' : 'center' });
            x += colWidths[i];
          });
          doc.moveDown(0.3);
        });
        doc.moveDown();
      }

      doc.moveDown(2);
      doc.fontSize(8).fillColor('#666').text('Gerado pelo Avalia+ Desktop em ' + new Date().toLocaleString('pt-BR'), { align: 'center' });
      doc.end();
    });
  }

  async generateCertificatePDF(data) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const settings = this.db.getSettings();

      // Borda decorativa
      doc.rect(20, 20, 802 - 40, 595 - 40).stroke('#1e40af');
      doc.rect(25, 25, 802 - 50, 595 - 50).stroke('#1e40af');

      doc.moveDown(3);
      doc.fontSize(28).font('Helvetica-Bold').fillColor('#1e40af').text('CERTIFICADO', { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(14).font('Helvetica').fillColor('#000').text('Certificamos que', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(22).font('Helvetica-Bold').text(data.participantName || 'Participante', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).font('Helvetica').text('participou com aproveitamento do', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e40af').text(data.eventTitle || 'Evento', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica').fillColor('#000').text(`realizado em ${data.eventDate || 'data'}`, { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(10).text(settings['app.institution'] || '', { align: 'center' });

      doc.moveDown(3);
      doc.moveTo(250, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.3);
      doc.fontSize(10).text('Coordenação', { align: 'center' });

      doc.end();
    });
  }

  async exportResultsCSV() {
    const settings = this.db.getSettings();
    const projW = parseFloat(settings['evaluation.proj_weight'] || '4');
    const intW = parseFloat(settings['evaluation.int_weight'] || '5');
    const langW = parseFloat(settings['evaluation.lang_weight'] || '1');
    const totalW = projW + intW + langW;

    const rows = this.db.db.prepare(`
      SELECT 
        s.protocol, s.nome, s.email, s.linha_pesquisa, s.status,
        AVG(e.proj_media) as media_projeto,
        AVG(e.int_media) as media_entrevista,
        AVG(e.lang_media) as media_lingua
      FROM submissions s
      LEFT JOIN evaluations e ON s.protocol = e.submission_protocol AND e.status = 'concluida'
      GROUP BY s.protocol
      ORDER BY s.nome
    `).all();

    const headers = ['Protocolo', 'Nome', 'E-mail', 'Linha', 'Status', 'Média Projeto', 'Média Entrevista', 'Média Língua', 'Nota Final'];
    const lines = [headers.join(';')];

    for (const r of rows) {
      const mp = r.media_projeto || 0;
      const me = r.media_entrevista || 0;
      const ml = r.media_lingua || 0;
      const nf = totalW > 0 ? ((mp * projW + me * intW + ml * langW) / totalW).toFixed(2) : '0';
      lines.push([
        r.protocol, r.nome, r.email || '', r.linha_pesquisa || '', r.status,
        mp ? mp.toFixed(2) : '', me ? me.toFixed(2) : '', ml ? ml.toFixed(2) : '', nf
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    }

    return lines.join('\n');
  }
}

module.exports = ReportService;
