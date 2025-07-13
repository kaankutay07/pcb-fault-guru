import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import type { PcbAnalysis, ChatMessage, Component } from '../types';

/**
 * Generates a comprehensive PDF report of the PCB analysis.
 * @param analysis - The PcbAnalysis object.
 * @param chatHistory - The array of chat messages.
 * @param boardVoltage - The current board voltage.
 */
export const generatePdfReport = async (
    analysis: PcbAnalysis,
    chatHistory: ChatMessage[],
    boardVoltage: number | null
): Promise<void> => {
    // 1. Setup PDF document
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: 'a4'
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let yPos = margin;

    // 2. Title and header
    doc.setFontSize(22);
    doc.text("PCB Guru - Analysis Report", pageWidth / 2, yPos, { align: 'center' });
    yPos += 20;
    doc.setFontSize(10);
    doc.text(`Report Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;
    doc.setFontSize(12);
    doc.text(analysis.summary, pageWidth/2, yPos, {align: 'center', maxWidth: contentWidth});
    yPos += 25;


    // 3. Page 1: Visual Analysis (Screenshot)
    const imageContainer = document.getElementById('analysis-image-container');
    if (imageContainer) {
        let canvas;
        try {
            canvas = await html2canvas(imageContainer, {
                useCORS: true,
                backgroundColor: '#1f2937', // bg-gray-800
                scale: 2, // Increase resolution for better quality
            });
        } catch (e) {
            console.error("html2canvas failed:", e);
            throw new Error("SCREENSHOT_FAILED"); 
        }

        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * contentWidth) / canvas.width;
        
        doc.setFontSize(16);
        doc.text("Visual Analysis", margin, yPos);
        yPos += 15;
        doc.addImage(imgData, 'PNG', margin, yPos, contentWidth, imgHeight);
        
        if (yPos + imgHeight > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
        } else {
             yPos += imgHeight + 20;
        }
    }
    
    const checkPageBreak = (heightNeeded: number) => {
        if (yPos + heightNeeded > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
        }
    };

    // 4. Page 2 onwards: Tables, Advice, Chat
    checkPageBreak(50); // Ensure there's space for the next section title
    
    // Advice Section
    if(analysis.advice) {
        doc.setFontSize(18);
        doc.text("Repair Advice", margin, yPos);
        yPos += 20;

        if (analysis.advice.repair_cost) {
            doc.setFontSize(10);
            doc.text(`Estimated Repair Cost: $${analysis.advice.repair_cost.toFixed(2)}`, margin, yPos);
            yPos += 15;
        }

        if (analysis.advice.quick_actions?.length > 0) {
            doc.setFontSize(12);
            doc.text("Quick Actions:", margin, yPos);
            yPos += 12;
            doc.setFontSize(9);
            analysis.advice.quick_actions.forEach(action => {
                const lines = doc.splitTextToSize(`- ${action}`, contentWidth - 5);
                checkPageBreak(lines.length * 10);
                doc.text(lines, margin + 5, yPos);
                yPos += lines.length * 10;
            });
            yPos += 10;
        }

        if (analysis.advice.alternatives?.length > 0) {
            checkPageBreak(50);
            doc.setFontSize(12);
            doc.text("Replacement Suggestions:", margin, yPos);
            yPos += 15;
             (doc as any).autoTable({
                startY: yPos,
                head: [['Original MPN', 'Replacement MPN', 'Reason']],
                body: analysis.advice.alternatives.flatMap(alt => 
                    alt.replacements.map(rep => [alt.original_mpn, rep.mpn, rep.reason])
                ),
                theme: 'grid',
                headStyles: { fillColor: '#1D4ED8' }, // blue-700
                styles: { fontSize: 8 },
                margin: { left: margin, right: margin }
            });
            yPos = (doc as any).lastAutoTable.finalY + 20;
        }
    }


    const componentsWithIssues = analysis.components.filter(c => 
        c.presence !== 'ok' || c.condition !== 'ok' || (boardVoltage && c.maxVoltage && boardVoltage > c.maxVoltage)
    );
    const okComponents = analysis.components.filter(c => 
        c.presence === 'ok' && c.condition === 'ok' && !(boardVoltage && c.maxVoltage && boardVoltage > c.maxVoltage)
    );

    const getComponentStatus = (c: Component): string => {
        if (c.condition === 'burnt') return 'Burnt';
        if (c.condition === 'corroded') return 'Corroded';
        if (c.presence === 'missing') return 'Missing';
        const voltageMismatch = boardVoltage && c.maxVoltage && boardVoltage > c.maxVoltage;
        if (voltageMismatch) return `Voltage Mismatch (${boardVoltage}V > ${c.maxVoltage}V)`;
        return 'OK';
    }

    // Table: Detected Defects
    if (analysis.defects.length > 0) {
        checkPageBreak(50);
        doc.setFontSize(16);
        doc.text("Detected Defects", margin, yPos);
        yPos += 15;
        (doc as any).autoTable({
            startY: yPos,
            head: [['ID', 'Type', 'Description', 'Confidence']],
            body: analysis.defects.map(d => [
                d.id,
                d.type.replace(/_/g, ' '),
                d.description || '-',
                `${(d.confidence * 100).toFixed(0)}%`
            ]),
            theme: 'grid',
            headStyles: { fillColor: '#A855F7' }, // purple-500
            styles: { fontSize: 8 },
            margin: { left: margin, right: margin }
        });
        yPos = (doc as any).lastAutoTable.finalY + 20;
    }

    // Table: Component Issues
    if (componentsWithIssues.length > 0) {
        checkPageBreak(50);
        doc.setFontSize(16);
        doc.text("Component Issues", margin, yPos);
        yPos += 15;
        (doc as any).autoTable({
            startY: yPos,
            head: [['Designator', 'MPN', 'Status', 'Temp (°C)']],
            body: componentsWithIssues.map(c => [
                c.designator,
                c.mpn,
                getComponentStatus(c),
                c.temperature?.toFixed(1) ?? 'N/A',
            ]),
            theme: 'grid',
            headStyles: { fillColor: '#F97316' }, // orange-500
            styles: { fontSize: 8 },
            margin: { left: margin, right: margin }
        });
        yPos = (doc as any).lastAutoTable.finalY + 20;
    }

    // Table: OK Components
     if (okComponents.length > 0) {
        checkPageBreak(50);
        doc.setFontSize(16);
        doc.text("OK Components", margin, yPos);
        yPos += 15;
        (doc as any).autoTable({
            startY: yPos,
            head: [['Designator', 'MPN', 'Status', 'Temp (°C)']],
            body: okComponents.map(c => [
                c.designator,
                c.mpn,
                'OK',
                c.temperature?.toFixed(1) ?? 'N/A',
            ]),
            theme: 'grid',
            headStyles: { fillColor: '#22C55E' }, // green-500
            styles: { fontSize: 8 },
            margin: { left: margin, right: margin }
        });
        yPos = (doc as any).lastAutoTable.finalY + 20;
    }
    
    // Chat History
    if (chatHistory.length > 0) {
        checkPageBreak(50);
        doc.setFontSize(16);
        doc.text("Repair Chat Log", margin, yPos);
        yPos += 15;

        chatHistory.forEach(msg => {
            const prefix = msg.role === 'user' ? "You: " : "Guru: ";
            const text = prefix + msg.text;
            const lines = doc.splitTextToSize(text, contentWidth);
            
            checkPageBreak(lines.length * 12 + 5);
            
            doc.setFontSize(10);
            doc.text(lines, margin, yPos);
            yPos += lines.length * 12 + 5;
        });
    }

    // 5. Save the PDF
    doc.save("pcb_report.pdf");
};