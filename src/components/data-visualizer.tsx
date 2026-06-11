
'use client';

import { useMemo } from 'react';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Download, ChartBar } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useData } from '@/context/data-context';
import { getMonthlySalesData, getStockByCategoryData, getInventoryValueData } from '@/lib/chart-utils';
import { generateReportInsights } from '@/ai/flows/report-generator';

type ChartType =
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'radar'
  | 'radialBar';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
];

const chartComponents = {
  bar: BarChart,
  line: LineChart,
  area: AreaChart,
  pie: PieChart,
  radar: RadarChart,
  radialBar: RadialBarChart,
};

export function DataVisualizer() {
  const { transactions, products, categories, isLoading } = useData();
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [metric, setMetric] = useState<'sales' | 'expenses' | 'profit'>('sales');
  const chartRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const data = useMemo(() => {
    if (isLoading) return [];
    
    // Time-series charts use monthly sales
    if (['bar', 'line', 'area'].includes(chartType)) {
      return getMonthlySalesData(transactions, products);
    }
    if (metric === 'sales' && chartType === 'pie') {
        return getStockByCategoryData(products, categories);
    }
    if (metric === 'sales' && (chartType === 'radar' || chartType === 'radialBar')) {
        return getInventoryValueData(products, categories);
    }
    return getMonthlySalesData(transactions, products);
  }, [transactions, products, categories, metric, chartType, isLoading]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          } else {
            entry.target.classList.remove("revealed");
          }
        });
      },
      {
        root: null,
        threshold: 0.1,
        rootMargin: "0px 0px -10% 0px"
      }
    );

    const items = document.querySelectorAll(".scroll-reveal-item");
    items.forEach(el => observer.observe(el));

    return () => items.forEach(el => observer.unobserve(el));
  }, [data]); // Re-observe when data changes

  const handleDownload = useCallback(async () => {
    if (!chartRef.current || data.length === 0) return;

    setIsDownloading(true);
    try {
      // 1. Get AI Insights
      const insights = await generateReportInsights(
        `Monthly ${metric.charAt(0).toUpperCase() + metric.slice(1)} Data`,
        metric,
        data
      );

      // 2. Capture Chart
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#0a0a0a', // Dark theme background
        logging: false,
        useCORS: true,
        scale: 2, // Higher quality
      });

      const imgData = canvas.toDataURL('image/png');
      
      // 3. Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let cursorY = margin;

      // Header
      pdf.setFillColor(18, 18, 18); // Dark header
      pdf.rect(0, 0, pageWidth, 40, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text('AnalyzeUp Data Report', margin, 25);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Generated on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, 34);

      cursorY = 50;

      // Section: Overview
      pdf.setTextColor(30, 30, 30);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${metric.toUpperCase()} VISUALIZATION`, margin, cursorY);
      cursorY += 10;

      // Add Chart
      const chartWidth = pageWidth - (margin * 2);
      const chartHeight = (canvas.height * chartWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', margin, cursorY, chartWidth, chartHeight);
      cursorY += chartHeight + 15;

      // Section: Data Summary
      pdf.setFontSize(14);
      pdf.text('Data Summary', margin, cursorY);
      cursorY += 8;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      const values = data.map(d => (d as any)[metric] || 0);
      const total = values.reduce((a: number, b: number) => a + b, 0);
      const avg = total / values.length;
      const max = Math.max(...values);
      const min = Math.min(...values);

      const stats = [
        `Total ${metric}: ₹${total.toLocaleString('en-IN')}`,
        `Average ${metric}: ₹${avg.toLocaleString('en-IN')}`,
        `Peak ${metric}: ₹${max.toLocaleString('en-IN')}`,
        `Lowest ${metric}: ₹${min.toLocaleString('en-IN')}`
      ];

      stats.forEach(stat => {
        pdf.text(`• ${stat}`, margin + 5, cursorY);
        cursorY += 6;
      });

      cursorY += 10;

      // Section: AI Insights
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('AI Strategic Insights', margin, cursorY);
      cursorY += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const summaryLines = pdf.splitTextToSize(insights.summary, pageWidth - (margin * 2));
      pdf.text(summaryLines, margin, cursorY);
      cursorY += (summaryLines.length * 5) + 8;

      // Key Observations
      pdf.setFont('helvetica', 'bold');
      pdf.text('Key Observations:', margin, cursorY);
      cursorY += 6;
      pdf.setFont('helvetica', 'normal');
      insights.keyObservations.forEach(obs => {
        const obsLines = pdf.splitTextToSize(obs, pageWidth - (margin * 2) - 10);
        pdf.text(`• `, margin + 2, cursorY);
        pdf.text(obsLines, margin + 7, cursorY);
        cursorY += (obsLines.length * 5) + 2;
      });

      cursorY += 8;

      // Recommendations
      pdf.setFont('helvetica', 'bold');
      pdf.text('Business Recommendations:', margin, cursorY);
      cursorY += 6;
      pdf.setFont('helvetica', 'normal');
      insights.recommendations.forEach(rec => {
        const recLines = pdf.splitTextToSize(rec, pageWidth - (margin * 2) - 10);
        pdf.text(`→ `, margin + 2, cursorY);
        pdf.text(recLines, margin + 7, cursorY);
        cursorY += (recLines.length * 5) + 2;
      });

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text('This report was automatically generated by AnalyzeUp AI. Strategic decisions should be verified with complete financial audits.', pageWidth / 2, pageHeight - 10, { align: 'center' });

      pdf.save(`AnalyzeUp-${metric}-Report.pdf`);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [chartType, metric, data]);
  
  const renderChart = () => {
    const ChartComponent = chartComponents[chartType];
    const commonProps = {
        data: data,
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        const item = payload[0].payload;
        const isCategorical = ['pie', 'radar', 'radialBar'].includes(chartType);
        
        return (
          <div className="rounded-lg border bg-popover/70 p-2 shadow-sm backdrop-blur-sm text-foreground">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col space-y-1">
                <span className="text-[0.70rem] uppercase text-muted-foreground">
                  {isCategorical ? 'Category' : 'Month'}
                </span>
                <span className="font-bold text-foreground">
                  {label || item.name}
                </span>
              </div>
              <div className="flex flex-col space-y-1">
                <span className="text-[0.70rem] uppercase text-muted-foreground">
                  {isCategorical ? 'Stock' : (metric === 'sales' ? 'Revenue' : metric.charAt(0).toUpperCase() + metric.slice(1))}
                </span>
                <span className="font-bold text-foreground">
                  {isCategorical ? payload[0].value.toLocaleString() : `₹${payload[0].value.toLocaleString('en-IN')}`}
                </span>
              </div>
            </div>
          </div>
        );
      }
    
      return null;
    };
    
    const commonChildren = [
      <CartesianGrid key="grid" strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />,
      <XAxis key="xaxis" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />,
      <YAxis key="yaxis" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value: number) => chartType === 'pie' || chartType === 'radialBar' || chartType === 'radar' ? value.toString() : `₹${value}`} />,
      <Tooltip key="tooltip" content={<CustomTooltip />} cursor={{ fill: "hsl(var(--accent))", opacity: 0.5 }} />,
      <Legend key="legend" />,
    ];

    if (data.length === 0 || (['bar', 'line', 'area'].includes(chartType) && data.every(i => (i as any)[metric] === 0))) {
        return (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-2">
              <ChartBar className='h-12 w-12 text-muted-foreground/20 mx-auto' />
              <p className="text-sm text-muted-foreground">Add products and transactions to see visualization.</p>
            </div>
          </div>
        );
    }
    
    switch (chartType) {
        case 'pie':
        return (
            <PieChart>
                <Pie data={data} dataKey={metric} nameKey="name" cx="50%" cy="50%" outerRadius={120} label>
                    {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
            </PieChart>
        );

        case 'radar':
            return (
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" />
                    <PolarRadiusAxis />
                    <Radar name={metric} dataKey={metric} stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.6} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                </RadarChart>
            )
        
        case 'radialBar':
            return (
                <RadialBarChart 
                    cx="50%" 
                    cy="50%" 
                    innerRadius="10%" 
                    outerRadius="80%" 
                    data={data}
                    startAngle={180}
                    endAngle={0}
                >
                    <RadialBar
                        label={{ position: 'insideStart', fill: '#fff' }}
                        background
                        dataKey={metric}
                    >
                     {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </RadialBar>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconSize={10} layout='vertical' verticalAlign='middle' align="right" />
                </RadialBarChart>
            );

        case 'line':
             return (
                <LineChart {...commonProps}>
                    {commonChildren}
                    <Line type="monotone" dataKey={metric} stroke="hsl(var(--primary))" strokeWidth={2} activeDot={{ r: 8 }} />
                </LineChart>
            );
        case 'area':
             return (
                <AreaChart {...commonProps}>
                    {commonChildren}
                    <Area type="monotone" dataKey={metric} stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                </AreaChart>
            );

        default: // bar
            return (
                <BarChart {...commonProps}>
                    {commonChildren}
                    <Bar dataKey={metric} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
            )
    }
  }


  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl font-semibold md:text-2xl">Data Visualizer</h1>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Select
            value={metric}
            onValueChange={(v) => setMetric(v as any)}
          >
            <SelectTrigger className="w-full sm:w-[150px] border-primary/30 bg-primary/5">
              <SelectValue placeholder="Select Metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sales">Revenue</SelectItem>
              <SelectItem value="expenses">Expenses</SelectItem>
              <SelectItem value="profit">Profit</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={chartType}
            onValueChange={(v) => setChartType(v as ChartType)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select chart type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bar">Bar Chart</SelectItem>
              <SelectItem value="line">Line Chart</SelectItem>
              <SelectItem value="area">Area Chart</SelectItem>
              <SelectItem value="pie">Pie Chart</SelectItem>
              <SelectItem value="radar">Radar Chart</SelectItem>
              <SelectItem value="radialBar">Radial Bar Chart</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleDownload} disabled={isDownloading} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            <span className='whitespace-nowrap'>{isDownloading ? 'Downloading...' : 'Download as PDF'}</span>
          </Button>
        </div>
      </div>
      <Card className="scroll-reveal-item">
        <CardHeader>
          <CardTitle>Sales Data Visualization</CardTitle>
          <CardDescription>
            Use the dropdown to select different ways to visualize the monthly sales data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div ref={chartRef} className="h-[400px] w-full bg-background p-4 rounded-lg">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
