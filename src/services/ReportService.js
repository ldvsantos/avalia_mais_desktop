// ============================================================
// ReportService — Geração de PDFs e Relatórios
// Modelo unificado: idêntico à versão web (PdfService.js)
// ============================================================
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class ReportService {
  constructor(db) {
    this.db = db;
    // Assets — mesma estrutura visual da versão web
    this.avaliaLogoPath = path.join(__dirname, '../../assets/logo_avalia_horizontal.png');
    this.avaliaLogoSquarePath = path.join(__dirname, '../../assets/logo_avalia_quadrado.png');
    this.certificateTemplatePath = path.join(__dirname, '../../assets/marca_certificado.png');
  }

  // ---------- Auxiliares (idênticos à versão web) ----------

  drawHeader(doc) {
    const leftX = 50;
    const topY = 45;
    const rightX = doc.page.width - 50;
    const hasAvalia = fs.existsSync(this.avaliaLogoPath);

    if (hasAvalia) {
      const avaliaWidth = 150;
      doc.image(this.avaliaLogoPath, rightX - avaliaWidth, topY, { width: avaliaWidth });
      doc.image(this.avaliaLogoPath, leftX, topY, { width: 150 });
    } else {
      doc.fontSize(20).text('Avalia Mais', leftX, topY);
    }

    doc.y = 140;
  }

  drawAllocationHeader(doc, editalYear) {
    const leftX = 50;
    const topY = 40;

    doc.font('Helvetica-Bold').fontSize(11).fillColor('black');
    doc.text('INSTITUIÇÃO EXEMPLO', leftX, topY + 5, {
      width: doc.page.width - 100,
      align: 'center',
    });

    doc.font('Helvetica').fontSize(10);
    doc.text('Programa de Pós-Graduação', {
      width: doc.page.width - 100,
      align: 'center',
    });
    doc.text('Mestrado Profissional', {
      width: doc.page.width - 100,
      align: 'center',
    });

    if (editalYear) {
      doc.moveDown(0.6);
      doc.font('Helvetica-Bold').fontSize(11).text(`EDITAL DE SELEÇÃO PARA ALUNO/A REGULAR ${editalYear}`, {
        width: doc.page.width - 100,
        align: 'center',
      });
    }

    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(12).text('RESULTADO FINAL', {
      width: doc.page.width - 100,
      align: 'center',
    });

    doc.y = Math.max(doc.y, 150);
  }

  drawAuditFooter(doc, auditInfo) {
    if (!auditInfo) return;

    const { user, hash, createdAt } = auditInfo;
    const dateStr = createdAt ? new Date(createdAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
    const userName = user || 'Sistema Avalia+ Desktop';

    const footerHeight = 80;
    if (doc.y > doc.page.height - footerHeight - 20) {
      doc.addPage();
    }

    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const startY = doc.page.height - footerHeight;
    const startX = 50;
    const width = doc.page.width - 100;

    doc.save();
    doc.fontSize(8).font('Helvetica');

    // Linha separadora
    doc.moveTo(startX, startY).lineTo(startX + width, startY).stroke();

    doc.text('Documento assinado digitalmente e auditado pelo sistema Avalia Mais.', startX, startY + 10, { align: 'center', width: width });
    doc.text(`Gerado por: ${userName} | Data: ${dateStr}`, startX, startY + 22, { align: 'center', width: width });
    if (hash) {
      doc.text(`Código de Verificação (Hash): ${hash}`, startX, startY + 34, { align: 'center', width: width });
    }

    doc.restore();
    doc.page.margins.bottom = bottom;
  }

  generateVerificationCode() {
    return crypto.randomBytes(5).toString('hex');
  }

  generateDocumentNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `${timestamp}${random}`.substring(0, 12);
  }

  // ---------- Comprovante de Inscrição (modelo web) ----------

  async generateSubmissionPDF(protocol) {
    const submission = this.db.db.prepare('SELECT * FROM submissions WHERE protocol = ?').get(protocol);
    if (!submission) throw new Error('Inscrição não encontrada');

    // Tenta parsear campos JSON se existirem
    let identified = {};
    let project = {};
    try { identified = submission.identified ? JSON.parse(submission.identified) : {}; } catch { /* noop */ }
    try { project = submission.project ? JSON.parse(submission.project) : {}; } catch { /* noop */ }

    // Fallback: usa colunas diretas da tabela se o JSON não existir
    if (!identified.nome) {
      identified = {
        nome: submission.nome,
        email: submission.email,
        cpf: submission.cpf,
        rg: submission.rg,
        orgao_expedidor: submission.orgao_expedidor,
        data_expedicao: submission.data_expedicao,
        data_nascimento: submission.data_nascimento,
        celular: submission.celular,
        telefone_residencial: submission.telefone_residencial,
        endereco: submission.endereco,
        cidade_estado: submission.cidade_estado,
        cep: submission.cep,
        curso_graduacao: submission.curso_graduacao,
        instituicao: submission.instituicao,
        ano_conclusao: submission.ano_conclusao,
        vaga_institucional: submission.vaga_institucional,
        vaga_cooperacao: submission.vaga_cooperacao,
        vaga_reservada: submission.vaga_reservada,
        cotas: submission.cotas,
        raca_cor: submission.raca_cor,
        lingua_estrangeira: submission.lingua_estrangeira,
        vinculo_empregaticio: submission.vinculo_empregaticio,
        carga_horaria: submission.carga_horaria,
        empresa_vinculo: submission.empresa_vinculo,
        termo_compromisso: submission.termo_compromisso,
        nome_social: submission.nome_social,
      };
    }
    if (!project.titulo_pt) {
      project = {
        titulo_pt: submission.titulo_pt,
        titulo_en: submission.titulo_en,
        area: submission.area,
        palavras_pt: submission.palavras_pt,
        palavras_en: submission.palavras_en,
        resumo: submission.resumo,
        justificativa_enquadramento: submission.justificativa_enquadramento,
        introducao: submission.introducao,
        problema_pesquisa: submission.problema_pesquisa,
        justificativa_relevancia: submission.justificativa_relevancia,
        objetivo_geral: submission.objetivo_geral,
        objetivos_especificos: submission.objetivos_especificos,
        objetivos: submission.objetivos,
        metas: submission.metas,
        revisao_literatura: submission.revisao_literatura,
        procedimentos_metodologicos: submission.procedimentos_metodologicos,
        cronograma: submission.cronograma,
        referencias: submission.referencias,
      };
    }

    const hash = submission.hash || '';
    const createdAt = submission.created_at ? new Date(submission.created_at) : new Date();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      this.drawHeader(doc);

      // Title
      doc.fontSize(18).font('Helvetica-Bold').text('Comprovante de Inscrição', { align: 'center' });
      doc.moveDown();

      // Protocol Info
      doc.fontSize(12).font('Helvetica').text(`Protocolo: ${protocol}`, { align: 'right' });
      doc.text(
        `Data: ${createdAt.toLocaleDateString('pt-BR')} ${createdAt.toLocaleTimeString('pt-BR')}`,
        { align: 'right' }
      );
      if (hash) {
        doc.fontSize(10).text(`Hash: ${hash}`, { align: 'right' });
      }
      doc.moveDown(2);

      const writeField = (label, value) => {
        if (value === undefined || value === null || String(value).trim() === '') return;
        doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
        doc.font('Helvetica').text(String(value));
      };

      // Dados do Candidato
      doc.fontSize(12).font('Helvetica-Bold').text('Dados do Candidato');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      writeField('Nome', identified.nome || identified.nome_social);
      if (identified.nome_social) writeField('Nome social', identified.nome_social);
      writeField('CPF', identified.cpf);
      writeField('RG', identified.rg);
      writeField('Órgão expedidor', identified.orgao_expedidor);
      writeField('Data de expedição', identified.data_expedicao);
      writeField('Data de nascimento', identified.data_nascimento);
      writeField('Email', identified.email);
      writeField('Celular', identified.celular);
      writeField('Telefone residencial', identified.telefone_residencial);
      writeField('Endereço', identified.endereco);
      writeField('Cidade/Estado', identified.cidade_estado);
      writeField('CEP', identified.cep);
      writeField('Curso de graduação', identified.curso_graduacao);
      writeField('Instituição', identified.instituicao);
      writeField('Ano de conclusão', identified.ano_conclusao);
      writeField('Vaga institucional', identified.vaga_institucional);
      writeField('Vaga cooperação', identified.vaga_cooperacao);
      writeField('Vaga reservada', identified.vaga_reservada);
      writeField('Cotas', identified.cotas);
      writeField('Raça/Cor', identified.raca_cor);
      writeField('Língua estrangeira', identified.lingua_estrangeira);
      writeField('Vínculo empregatício', identified.vinculo_empregaticio);
      writeField('Carga horária', identified.carga_horaria);
      writeField('Empresa', identified.empresa_vinculo);
      writeField('Termo de compromisso', identified.termo_compromisso);

      doc.moveDown(1.5);

      // Dados do Projeto
      doc.fontSize(12).font('Helvetica-Bold').text('Dados do Projeto');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      writeField('Título (PT)', project.titulo_pt);
      writeField('Título (EN)', project.titulo_en);
      writeField('Área', project.area);
      writeField('Palavras-chave (PT)', project.palavras_pt);
      writeField('Palavras-chave (EN)', project.palavras_en);

      const writeSection = (title, value) => {
        const text = String(value || '').trim();
        if (!text) return;
        doc.moveDown(0.8);
        doc.font('Helvetica-Bold').text(title);
        doc.moveDown(0.3);
        doc.font('Helvetica').text(text, { align: 'justify' });
      };

      writeSection('Resumo', project.resumo);
      writeSection('Justificativa / Enquadramento', project.justificativa_enquadramento);
      writeSection('Introdução', project.introducao);
      writeSection('Problema de pesquisa', project.problema_pesquisa);
      writeSection('Justificativa / Relevância', project.justificativa_relevancia);
      writeSection('Objetivo geral', project.objetivo_geral);
      writeSection('Objetivos específicos', project.objetivos_especificos);
      writeSection('Objetivos (campo alternativo)', project.objetivos);
      writeSection('Metas', project.metas);
      writeSection('Revisão de literatura', project.revisao_literatura);
      writeSection('Procedimentos metodológicos', project.procedimentos_metodologicos);
      writeSection('Cronograma', project.cronograma);
      writeSection('Referências', project.referencias);

      // Footer Audit com hash
      this.drawAuditFooter(doc, {
        user: 'Avalia+ Desktop',
        hash: hash,
        createdAt: createdAt,
      });

      doc.end();
    });
  }

  // ---------- Relatório de Alocação (modelo web) ----------

  async generateAllocationPDF(data) {
    const editalYear = data?.editalYear;

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Header institucional
        this.drawAllocationHeader(doc, editalYear);

        const drawConvocadosTable = (title, candidates) => {
          if (!candidates || candidates.length === 0) return;

          doc.fontSize(12).font('Helvetica-Bold').text(title, { underline: true });
          doc.moveDown(0.5);

          const startX = 50;
          const colWidths = [260, 235];
          const headers = ['NOME DO/A CANDIDATO/A', 'VAGA OCUPADA'];

          let currentY = doc.y;

          // Header Row
          doc.fontSize(9).font('Helvetica-Bold');
          doc.rect(startX, currentY, 495, 20).fill('#e0e0e0');
          doc.fillColor('black');

          let currentX = startX + 5;
          headers.forEach((h, i) => {
            doc.text(h, currentX, currentY + 5, { width: colWidths[i], align: 'left' });
            currentX += colWidths[i];
          });

          currentY += 20;
          doc.font('Helvetica').fontSize(9);

          candidates.forEach((c, i) => {
            if (currentY > doc.page.height - 100) {
              doc.addPage();
              this.drawAllocationHeader(doc, editalYear);
              currentY = doc.y;
            }

            const rowHeight = 20;
            if (i % 2 === 0) {
              doc.rect(startX, currentY, 495, rowHeight).fill('#f9f9f9');
              doc.fillColor('black');
            }

            currentX = startX + 5;
            const values = [
              String(c.nome || '').substring(0, 60),
              String(c.situacao || c.tipoVaga || '')
            ];

            values.forEach((v, idx) => {
              doc.text(v, currentX, currentY + 5, { width: colWidths[idx], align: 'left' });
              currentX += colWidths[idx];
            });

            currentY += rowHeight;
          });

          doc.moveDown(2);
        };

        const drawListaReservaTable = (title, candidates) => {
          if (!candidates || candidates.length === 0) return;

          doc.fontSize(12).font('Helvetica-Bold').text(title, { underline: true });
          doc.moveDown(0.5);

          const startX = 50;

          let currentY = doc.y;

          doc.fontSize(9).font('Helvetica-Bold');
          doc.rect(startX, currentY, 495, 20).fill('#e0e0e0');
          doc.fillColor('black');
          doc.text('NOME DO/A CANDIDATO/A', startX + 5, currentY + 5, { width: 490, align: 'left' });

          currentY += 20;
          doc.font('Helvetica').fontSize(9);

          candidates.forEach((c, i) => {
            if (currentY > doc.page.height - 100) {
              doc.addPage();
              this.drawAllocationHeader(doc, editalYear);
              currentY = doc.y;
            }

            const rowHeight = 20;
            if (i % 2 === 0) {
              doc.rect(startX, currentY, 495, rowHeight).fill('#f9f9f9');
              doc.fillColor('black');
            }

            doc.text(String(c.nome || '').substring(0, 80), startX + 5, currentY + 5, { width: 490, align: 'left' });
            currentY += rowHeight;
          });

          doc.moveDown(2);
        };

        const processLine = (lineName, lineData) => {
          if (!lineData) return;

          if (doc.y > doc.page.height - 150) doc.addPage();

          doc.fontSize(14).font('Helvetica-Bold').fillColor('#2e7d32').text(lineName);
          doc.fillColor('black');
          doc.moveDown(0.5);

          // Suporta formato web (com resultado.aprovados) e formato desktop
          const resultado = lineData.resultado || lineData;
          const aprovados = resultado.aprovados || lineData.aprovados || [];
          const listaEspera = resultado.lista_espera || lineData.lista_espera || [];
          const quadro = resultado.quadro_vagas_calculado || lineData.quadro_vagas_calculado;
          const allocator = lineData.allocator || {};
          const total = lineData.total || aprovados.length;
          const vagasExtras = allocator.vagasExtras || {};

          doc.fontSize(10).font('Helvetica');
          doc.text(`Total de Vagas: ${total}`);

          if (Object.keys(vagasExtras).length > 0) {
            const extrasText = Object.entries(vagasExtras).map(([k, v]) => `${v} (${k.replace('_', ' ')})`).join(', ');
            doc.text(`Vagas Extras (Institucionais): ${extrasText}`);
          }

          if (quadro) {
            doc.moveDown(0.5);
            doc.text('Distribuição Calculada:', { underline: true });
            doc.text(`Ampla: ${quadro.AC || 0} | Cotas (Negros): ${quadro.Cotas_Negros || 0} | Cotas (Demais): ${quadro.Cotas_Demais || 0}`);
            if (quadro.Institucional) {
              const instText = Object.entries(quadro.Institucional).map(([k, v]) => `${v} (${k.replace('_', ' ')})`).join(', ');
              doc.text(`Institucionais: ${instText}`);
            }
          }

          doc.moveDown(1);

          drawConvocadosTable('CANDIDATOS/AS APROVADOS/AS – CONVOCADOS/AS', aprovados);
          drawListaReservaTable('CANDIDATOS/AS APROVADOS/AS – EM LISTA DE RESERVA', listaEspera);
        };

        // Suporta formato web (linha1/linha2) e formato desktop (allocation map)
        if (data.linha1 || data.linha2) {
          processLine('Linha de Pesquisa 1', data.linha1);
          processLine('Linha de Pesquisa 2', data.linha2);
        } else if (data.allocation) {
          for (const [line, candidates] of Object.entries(data.allocation)) {
            processLine(line, { aprovados: candidates, total: candidates.length });
          }
        }

        // Data e local
        doc.moveDown(1);
        doc.font('Helvetica').fontSize(10).fillColor('black');
        doc.text(`Feira de Santana, ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.`);

        // Assinaturas
        if (doc.y > doc.page.height - 150) doc.addPage();
        doc.moveDown(4);

        const sigY = doc.y;
        const sigWidth = 200;
        const gap = 50;
        const startX = (doc.page.width - (sigWidth * 2 + gap)) / 2;

        doc.moveTo(startX, sigY).lineTo(startX + sigWidth, sigY).stroke();
        doc.text('Presidente da Comissão', startX, sigY + 10, { width: sigWidth, align: 'center' });

        doc.moveTo(startX + sigWidth + gap, sigY).lineTo(startX + sigWidth + gap + sigWidth, sigY).stroke();
        doc.text('Membro da Comissão', startX + sigWidth + gap, sigY + 10, { width: sigWidth, align: 'center' });

        // Audit footer
        const auditHash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 16);
        this.drawAuditFooter(doc, {
          user: 'Avalia+ Desktop',
          hash: auditHash,
          createdAt: new Date(),
        });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ---------- Comprovante de Recurso (modelo web — novo no desktop) ----------

  async generateAppealPDF(data) {
    const protocol = data?.protocol || 'N/A';
    const createdAt = data?.createdAt ? new Date(data.createdAt) : new Date();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      this.drawHeader(doc);

      // Title
      doc.fontSize(18).font('Helvetica-Bold').text('Comprovante de Recurso', { align: 'center' });
      doc.moveDown();

      // Protocol Info
      doc.fontSize(12).font('Helvetica').text(`Protocolo: ${protocol}`, { align: 'right' });
      doc.text(
        `Data: ${createdAt.toLocaleDateString('pt-BR')} ${createdAt.toLocaleTimeString('pt-BR')}`,
        { align: 'right' }
      );
      doc.moveDown(2);

      const writeField = (label, value) => {
        if (!value) return;
        doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
        doc.font('Helvetica').text(String(value));
      };

      const writeSection = (title, value) => {
        const text = String(value || '').trim();
        if (!text) return;
        doc.moveDown(0.8);
        doc.font('Helvetica-Bold').text(title);
        doc.moveDown(0.3);
        doc.font('Helvetica').text(text, { align: 'justify' });
      };

      // Dados do Candidato
      doc.fontSize(12).font('Helvetica-Bold').text('Dados do Candidato');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      writeField('Nome', data?.nome);
      writeField('CPF', data?.cpf);
      writeField('Email', data?.email);

      doc.moveDown(1.5);

      // Projeto
      doc.fontSize(12).font('Helvetica-Bold').text('Dados do Projeto');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      writeField('Protocolo de inscrição', data?.protocolo_inscricao || data?.submissionProtocol);
      writeField('Título do projeto', data?.titulo_projeto || data?.tituloProjeto);
      writeField('Linha de pesquisa', data?.linha_pesquisa || data?.linhaPesquisa);

      doc.moveDown(1.5);

      // Dados do Recurso
      doc.fontSize(12).font('Helvetica-Bold').text('Dados do Recurso');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      writeField('Etapa do processo', data?.etapa_processo || data?.etapa);
      writeSection('Decisão objeto da contestação', data?.decisao_contestacao || data?.decisaoContestacao);
      writeSection('Argumentação', data?.argumentacao);

      // Audit footer
      const hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 16);
      this.drawAuditFooter(doc, {
        user: 'Avalia+ Desktop',
        hash: hash,
        createdAt: createdAt,
      });

      doc.end();
    });
  }

  // ---------- Certificado de Participação (modelo web) ----------

  async generateCertificatePDF(data) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 0, size: 'A4', layout: 'landscape' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const {
        participantName, nome, cpf,
        eventTitle, curso, eventDate, data: dataEvento,
        cargaHoraria, coordinator, department,
        speakers, role, syllabus, activities,
      } = data;

      const nameToUse = participantName || nome || 'Participante';
      const titleToUse = eventTitle || curso || 'Evento';
      const dateToUse = eventDate || dataEvento || '';
      const cpfToUse = cpf || 'N/A';

      const width = doc.page.width;
      const height = doc.page.height;

      const verificationCode = this.generateVerificationCode();
      const documentNumber = this.generateDocumentNumber();

      // Página 1: template como fundo + texto por cima
      if (fs.existsSync(this.certificateTemplatePath)) {
        doc.image(this.certificateTemplatePath, 0, 0, { width, height });
      }

      const leftMargin = 80;
      const topStart = 280;
      const textWidth = 480;

      const formatWorkload = (value) => {
        if (value === null || value === undefined) return '0 hora(s)';
        if (typeof value === 'number') return `${value} hora(s)`;
        const str = String(value).trim();
        if (!str) return '0 hora(s)';
        if (/hora/i.test(str)) return str;
        return `${str} hora(s)`;
      };

      const workloadText = formatWorkload(cargaHoraria);

      doc.font('Helvetica').fontSize(13).fillColor('#000000');
      const speakersText = speakers ? `, ministrado por ${String(speakers).toUpperCase()}` : '';
      const textoCompleto = `Certificamos que ${nameToUse.toUpperCase()}, CPF ${cpfToUse}, participou da Atividade de Extensão ${titleToUse.toUpperCase()}${speakersText}, na função de ${(role || 'PARTICIPANTE').toUpperCase()}, com ${workloadText} de atividades desenvolvidas. A atividade foi realizada ${dateToUse ? 'no dia ' + dateToUse : 'conforme programação'}.`;
      doc.text(textoCompleto, leftMargin, topStart, { align: 'left', width: textWidth, lineGap: 4 });

      const localEmissao = 'Feira de Santana';
      const dataEmissao = new Date().toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      doc.fontSize(11).font('Helvetica').text(`${localEmissao}, ${dataEmissao}`, leftMargin, doc.y + 24, {
        align: 'left',
        width: textWidth,
      });

      const footerY = height - 80;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`Código de verificação: ${verificationCode}`, leftMargin, footerY, { align: 'left', width: textWidth });
      doc.fontSize(9).font('Helvetica').fillColor('#000000');
      doc.text(`Número do Documento: ${documentNumber}`, leftMargin, footerY + 14, { align: 'left', width: textWidth });

      // Página 2 (anexo): ementa/atividades
      const parsedActivities = (() => {
        if (!activities) return null;
        if (Array.isArray(activities)) return activities;
        if (typeof activities === 'string') {
          try {
            const parsed = JSON.parse(activities);
            return Array.isArray(parsed) ? parsed : null;
          } catch { return null; }
        }
        return null;
      })();

      const hasAnnex = (syllabus && String(syllabus).trim()) || (parsedActivities && parsedActivities.length > 0);
      if (hasAnnex) {
        doc.addPage({ margin: 50, size: 'A4', layout: 'landscape' });

        const w2 = doc.page.width;
        const h2 = doc.page.height;
        const startX2 = 50;
        const textOptions2 = { align: 'justify', width: w2 - 100 };

        doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000').text('ANEXO - ATIVIDADES E EMENTA', { align: 'center' });
        doc.moveDown(1);

        doc.font('Helvetica').fontSize(10).fillColor('#000000');
        doc.text(`Evento: ${titleToUse.toUpperCase()}`, startX2, doc.y, textOptions2);
        doc.text(`Participante: ${nameToUse.toUpperCase()}  |  CPF: ${cpfToUse}`, startX2, doc.y + 2, textOptions2);
        if (speakers) doc.text(`Palestrante(s)/Ministrante(s): ${String(speakers).toUpperCase()}`, startX2, doc.y + 2, textOptions2);
        if (coordinator) doc.text(`Coordenador(a): ${String(coordinator).toUpperCase()}`, startX2, doc.y + 2, textOptions2);
        if (department) doc.text(`Departamento/Órgão Promotor: ${String(department).toUpperCase()}`, startX2, doc.y + 2, textOptions2);

        doc.moveDown(1);

        if (syllabus && String(syllabus).trim()) {
          doc.fontSize(11).font('Helvetica-Bold').text('Ementa:', startX2, doc.y);
          doc.fontSize(10).font('Helvetica').text(String(syllabus).trim(), startX2, doc.y + 2, textOptions2);
          doc.moveDown(1);
        }

        if (parsedActivities && parsedActivities.length > 0) {
          doc.fontSize(11).font('Helvetica-Bold').text('Atividades:', startX2, doc.y);
          doc.moveDown(0.3);

          const tableTop = doc.y;
          const tableLeft = startX2;
          const totalWidth = w2 - 100;
          const colAtividade = Math.floor(totalWidth * 0.62);
          const colFuncao = Math.floor(totalWidth * 0.24);
          const colCarga = totalWidth - colAtividade - colFuncao;

          doc.rect(tableLeft, tableTop, totalWidth, 20).fillAndStroke('#f0f0f0', '#000000');
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
          doc.text('Atividades', tableLeft + 5, tableTop + 6, { width: colAtividade - 10 });
          doc.text('Função', tableLeft + colAtividade + 5, tableTop + 6, { width: colFuncao - 10 });
          doc.text('Carga', tableLeft + colAtividade + colFuncao + 5, tableTop + 6, { width: colCarga - 10 });

          let currentY = tableTop + 20;
          doc.fontSize(8).font('Helvetica').fillColor('#000000');

          parsedActivities.forEach((activity) => {
            const rowHeight = 18;
            doc.rect(tableLeft, currentY, totalWidth, rowHeight).stroke('#000000');
            doc.text(String(activity?.name || ''), tableLeft + 5, currentY + 5, { width: colAtividade - 10 });
            doc.text(String(activity?.role || ''), tableLeft + colAtividade + 5, currentY + 5, { width: colFuncao - 10 });
            doc.text(String(activity?.workload || '0'), tableLeft + colAtividade + colFuncao + 5, currentY + 5, { width: colCarga - 10 });
            currentY += rowHeight;
          });

          const totalWorkload = parsedActivities.reduce((sum, act) => sum + (parseFloat(act?.workload) || 0), 0);
          doc.rect(tableLeft, currentY, totalWidth, 20).fillAndStroke('#f0f0f0', '#000000');
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
          doc.text('Total', tableLeft + 5, currentY + 6, { width: colAtividade + colFuncao - 10 });
          doc.text(`${totalWorkload} hora(s)`, tableLeft + colAtividade + colFuncao + 5, currentY + 6, { width: colCarga - 10 });

          doc.y = currentY + 30;
        }

        doc.y = h2 - 90;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000').text(
          `Código de verificação: ${verificationCode}  |  Número do Documento: ${documentNumber}`,
          startX2,
          doc.y,
          { align: 'left' }
        );
      }

      doc.end();
    });
  }

  // ---------- Relatório de Integridade Acadêmica (modelo web — novo no desktop) ----------

  async generateIntegrityReportPDF(submission, integrity) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      this.drawHeader(doc);

      // Title
      doc.fontSize(18).font('Helvetica-Bold').text('Relatório de Integridade Acadêmica', { align: 'center' });
      doc.moveDown();

      const protocol = submission?.protocol || 'N/A';
      const title = submission?.titulo_pt || submission?.project?.titulo_pt || 'N/A';
      const createdAt = new Date();

      doc.fontSize(10).font('Helvetica').text(`Gerado em: ${createdAt.toLocaleString('pt-BR')}`, { align: 'right' });
      doc.moveDown();

      doc.fontSize(12).font('Helvetica-Bold').text(`Protocolo: ${protocol}`);
      doc.font('Helvetica').text(`Título: ${title}`);
      doc.moveDown();

      // Scores
      const score = integrity.score != null ? integrity.score + '%' : '—';
      const aiScore = integrity.aiScore != null ? integrity.aiScore + '%' : '—';

      doc.fontSize(14).font('Helvetica-Bold').text('1. Resumo da Análise', { underline: true });
      doc.moveDown(0.5);

      const startY = doc.y;
      doc.rect(50, startY, 250, 60).stroke();
      doc.fontSize(12).text('Índice de Plágio', 60, startY + 10);
      doc.fontSize(24).font('Helvetica-Bold').fillColor(integrity.score > 20 ? 'red' : 'green').text(score, 60, startY + 30);

      doc.rect(310, startY, 250, 60).stroke();
      doc.fontSize(12).font('Helvetica-Bold').fillColor('black').text('Probabilidade de IA', 320, startY + 10);
      doc.fontSize(24).font('Helvetica-Bold').fillColor(integrity.aiScore > 50 ? 'red' : 'orange').text(aiScore, 320, startY + 30);

      doc.fillColor('black').moveDown(4);

      // Interpretation
      const interpretation = integrity.interpretation || {};
      if (interpretation.status_label) {
        doc.fontSize(12).font('Helvetica-Bold').text('Parecer do Sistema:');
        doc.font('Helvetica').text(interpretation.status_label, { continued: true });
        doc.text(' - ' + (interpretation.explanation_text || ''));
        doc.moveDown();
      }

      // Sources
      const matches = integrity.matches || [];
      const sources = integrity.sources || [];
      const scannedText = integrity.scannedText || '';
      const totalLength = scannedText.length;

      const sourceStats = {};
      sources.forEach(url => { sourceStats[url] = 0; });

      if (totalLength > 0) {
        matches.forEach(m => {
          if (m.source) {
            if (typeof sourceStats[m.source] === 'undefined') sourceStats[m.source] = 0;
            sourceStats[m.source] += m.text.length;
          }
        });
        Object.keys(sourceStats).forEach(url => {
          sourceStats[url] = (sourceStats[url] / totalLength) * 100;
        });
      } else {
        matches.forEach(m => {
          if (m.source && (!sourceStats[m.source] || m.score > sourceStats[m.source])) {
            sourceStats[m.source] = m.score;
          }
        });
      }

      if (Object.keys(sourceStats).length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').text('2. Fontes Identificadas', { underline: true });
        doc.moveDown(0.5);

        const tableTop = doc.y;
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Fonte (URL)', 50, tableTop);
        doc.text('Similaridade', 450, tableTop, { width: 100, align: 'right' });
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
        doc.moveDown();

        doc.font('Helvetica');
        Object.entries(sourceStats)
          .sort(([, a], [, b]) => b - a)
          .forEach(([url, sc]) => {
            if (sc < 0.1) return;
            const y = doc.y;
            if (y > doc.page.height - 100) {
              doc.addPage();
              doc.y = 50;
            }
            doc.fillColor('blue').text(url, 50, doc.y, { link: url, width: 380, lineBreak: false, ellipsis: true });
            doc.fillColor(sc > 3 ? 'red' : 'black').text(`${sc.toFixed(2)}%`, 450, doc.y, { width: 100, align: 'right' });
            doc.moveDown(0.5);
          });
        doc.fillColor('black').moveDown();
      }

      // Detailed Matches
      if (matches.length > 0) {
        doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').text('3. Detalhamento dos Trechos (Evidências)', { underline: true });
        doc.moveDown();

        matches.forEach((match, index) => {
          if (doc.y > doc.page.height - 150) doc.addPage();

          doc.fontSize(11).font('Helvetica-Bold').fillColor('black').text(`Coincidência #${index + 1}`);
          doc.fontSize(10).font('Helvetica').text(`Fonte: ${match.source}`, { link: match.source });
          doc.text(`Similaridade do Trecho: ${match.score}%`);
          doc.moveDown(0.5);

          doc.font('Helvetica-Oblique').fillColor('#8B0000');
          doc.text(`"${match.text}"`, { indent: 20 });
          doc.fillColor('black');
          doc.moveDown();
          doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#ccc').stroke().strokeColor('black');
          doc.moveDown();
        });
      }

      // Reference Analysis
      const refAnalysis = integrity.referenceAnalysis;
      if (refAnalysis && Array.isArray(refAnalysis) && refAnalysis.length > 0) {
        doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').text('4. Verificação de Referências (Alucinações)', { underline: true });
        doc.fontSize(10).font('Helvetica-Oblique').text('(Análise automática de existência das referências citadas)');
        doc.moveDown();

        refAnalysis.forEach((item) => {
          if (doc.y > doc.page.height - 100) doc.addPage();

          let color = 'black';
          let icon = '[?]';
          if (item.status === 'Real') { color = 'green'; icon = '[OK]'; }
          if (item.status === 'Suspeita') { color = 'orange'; icon = '[!]'; }
          if (item.status === 'Alucinação') { color = 'red'; icon = '[X]'; }

          doc.fontSize(11).font('Helvetica-Bold').fillColor(color).text(`${icon} ${item.status}`, { continued: true });
          doc.font('Helvetica').fillColor('black').text(`: ${item.reason || ''}`);
          doc.fontSize(10).font('Helvetica-Oblique').text(item.ref, { indent: 15 });
          doc.moveDown(0.5);
        });
        doc.moveDown();
      }

      // Full Text
      if (scannedText) {
        doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').text(refAnalysis ? '5. Texto Completo Analisado' : '4. Texto Completo Analisado', { underline: true });
        doc.fontSize(10).font('Helvetica-Oblique').text('(Os trechos acima foram localizados dentro deste conteúdo)');
        doc.moveDown();
        doc.fontSize(10).font('Helvetica').fillColor('black').text(scannedText, { align: 'justify', lineGap: 2 });
        doc.moveDown();
      }

      // Tips
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text(refAnalysis ? '6. Dicas de Verificação (Vícios de IA)' : '5. Dicas de Verificação (Vícios de IA)', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.list([
        'Estrutura Padronizada: Uso excessivo de listas ou travessões.',
        'Tom Enciclopédico: Texto excessivamente didático.',
        'Conectivos Repetitivos: Uso mecânico de "Além disso", "Por outro lado".',
        'Alucinação Bibliográfica: Citações inexistentes.'
      ]);

      // Audit footer
      const auditHash = crypto.createHash('sha256').update(JSON.stringify({ protocol, integrity })).digest('hex').substring(0, 16);
      this.drawAuditFooter(doc, {
        user: 'Avalia+ Desktop',
        hash: auditHash,
        createdAt: createdAt,
      });

      doc.end();
    });
  }

  // ---------- CSV (mantido) ----------

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
