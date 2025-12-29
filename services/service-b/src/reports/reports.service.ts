import { Injectable, Logger } from '@nestjs/common';
import { LogsService } from '../logs/logs.service';
import PDFDocument from 'pdfkit';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly chartJSNodeCanvas: ChartJSNodeCanvas;

  constructor(private readonly logsService: LogsService) {
    this.chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: 800,
      height: 400,
      backgroundColour: 'white',
    });
  }

  async generatePDFReport(
    startDate: string,
    endDate: string,
    type?: string,
  ): Promise<Buffer> {
    this.logger.log(`Generating PDF report from ${startDate} to ${endDate}`);

    const timeSeriesData = await this.logsService.getTimeSeriesData(
      startDate,
      endDate,
      type,
    );

    const groupedData = this.groupByEventType(timeSeriesData);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => {});

    doc.fontSize(24).text('Time Series Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Period: ${startDate} to ${endDate}`, {
      align: 'center',
    });
    if (type) {
      doc.text(`Event Type: ${type}`, { align: 'center' });
    }
    doc.moveDown();

    if (Object.keys(groupedData).length === 0) {
      doc.fontSize(14).text('No data available for the selected period.', {
        align: 'center',
      });
    } else {
      for (const [eventType, data] of Object.entries(groupedData)) {
        doc.addPage();
        doc.fontSize(18).text(`Event: ${eventType}`, { align: 'center' });
        doc.moveDown(2);

        const stats = this.calculateStatistics(data);
        const statsY = doc.y;
        const statsX = 50;
        const lineHeight = 20;
        doc.fontSize(12);
        doc.text(`Total Events: ${stats.count}`, statsX, statsY);
        doc.text(
          `Average Value: ${stats.average.toFixed(2)}`,
          statsX,
          statsY + lineHeight,
        );
        doc.text(`Min Value: ${stats.min}`, statsX, statsY + lineHeight * 2);
        doc.text(`Max Value: ${stats.max}`, statsX, statsY + lineHeight * 3);

        const chartImage = await this.generateChart(eventType, data);
        const chartWidth = 400;
        const chartHeight = 250;
        const chartX = doc.page.width - chartWidth - 20;
        doc.image(chartImage, chartX, statsY, {
          fit: [chartWidth, chartHeight],
        });
      }

      doc.addPage();
      doc.fontSize(18).text('Summary', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12);

      for (const [eventType, data] of Object.entries(groupedData)) {
        const stats = this.calculateStatistics(data);
        doc.text(`${eventType}:`, { continued: true, underline: true });
        doc.text(` ${stats.count} events, avg: ${stats.average.toFixed(2)}`, {
          underline: false,
        });
        doc.moveDown(0.5);
      }
    }

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);
      doc.end();
    });
  }

  private groupByEventType(
    data: Array<{ timestamp: number; value: number; event: string }>,
  ): Record<string, Array<{ timestamp: number; value: number }>> {
    const grouped: Record<
      string,
      Array<{ timestamp: number; value: number }>
    > = {};

    for (const item of data) {
      if (!grouped[item.event]) {
        grouped[item.event] = [];
      }
      grouped[item.event].push({
        timestamp: item.timestamp,
        value: item.value,
      });
    }

    return grouped;
  }

  private async generateChart(
    eventType: string,
    data: Array<{ timestamp: number; value: number }>,
  ): Promise<Buffer> {
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);

    const labels = sortedData.map((item) =>
      new Date(item.timestamp).toLocaleDateString(),
    );
    const values = sortedData.map((item) => item.value);

    const configuration = {
      type: 'line' as const,
      data: {
        labels,
        datasets: [
          {
            label: eventType,
            data: values,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.1,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Time Series: ${eventType}`,
            font: {
              size: 16,
              family: 'DejaVu Sans',
            },
          },
          legend: {
            display: true,
            labels: {
              font: {
                family: 'DejaVu Sans',
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Value',
              font: {
                family: 'DejaVu Sans',
              },
            },
            ticks: {
              font: {
                family: 'DejaVu Sans',
              },
            },
          },
          x: {
            title: {
              display: true,
              text: 'Date',
              font: {
                family: 'DejaVu Sans',
              },
            },
            ticks: {
              font: {
                family: 'DejaVu Sans',
              },
            },
          },
        },
      },
    };

    return await this.chartJSNodeCanvas.renderToBuffer(configuration);
  }

  private calculateStatistics(data: Array<{ value: number }>): {
    count: number;
    average: number;
    min: number;
    max: number;
  } {
    if (data.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0 };
    }

    const values = data.map((item) => item.value);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const average = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      count: data.length,
      average,
      min,
      max,
    };
  }
}
