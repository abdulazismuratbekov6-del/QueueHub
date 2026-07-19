import { Injectable, NotFoundException } from "@nestjs/common";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  private async getQueueWithMembers(queueId: string) {
    const queue = await this.prisma.queue.findUnique({ where: { id: queueId } });
    if (!queue) {
      throw new NotFoundException("Очередь не найдена");
    }
    const members = await this.prisma.queueMember.findMany({
      where: { queueId, leftAt: null },
      orderBy: { position: "asc" },
      include: { user: true },
    });
    return { queue, members };
  }

  async exportPdf(queueId: string, res: Response) {
    const { queue, members } = await this.getQueueWithMembers(queueId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${queue.roomCode}-queue.pdf"`,
    );

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    doc.fontSize(18).text(queue.title, { underline: true });
    doc.fontSize(12).text(`Предмет: ${queue.subject}`);
    doc.text(`Код комнаты: ${queue.roomCode}`);
    doc.text(`Дата экспорта: ${new Date().toLocaleString("ru-RU")}`);
    doc.moveDown();

    members.forEach((member) => {
      const fullName = [member.user.firstName, member.user.lastName].filter(Boolean).join(" ");
      doc.text(`${member.position}. ${fullName}`);
    });

    if (members.length === 0) {
      doc.text("Очередь пуста");
    }

    doc.end();
  }

  async exportExcel(queueId: string, res: Response) {
    const { queue, members } = await this.getQueueWithMembers(queueId);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Очередь");

    sheet.columns = [
      { header: "Позиция", key: "position", width: 10 },
      { header: "Имя", key: "firstName", width: 20 },
      { header: "Фамилия", key: "lastName", width: 20 },
      { header: "Вошёл в", key: "joinedAt", width: 22 },
    ];

    members.forEach((member) => {
      sheet.addRow({
        position: member.position,
        firstName: member.user.firstName,
        lastName: member.user.lastName ?? "",
        joinedAt: member.joinedAt.toLocaleString("ru-RU"),
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${queue.roomCode}-queue.xlsx"`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}
