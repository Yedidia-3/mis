import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { BASE_URL } from "../../lib/api";

interface ExportClassListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  exportUrl: string;
}

export function ExportClassListDialog({ open, onOpenChange, title, exportUrl }: ExportClassListDialogProps) {
  const [format, setFormat] = useState<"xlsx" | "docx">("xlsx");
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE_URL}${exportUrl}?format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] ?? `class-list.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download started");
      onOpenChange(false);
    } catch {
      toast.error("Failed to export class list");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export {title}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <RadioGroup value={format} onValueChange={(v) => setFormat(v as "xlsx" | "docx")}>
            <div className="space-y-3">
              <div
                className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer"
                style={{ borderColor: format === "xlsx" ? "var(--maroon)" : "var(--border)" }}
                onClick={() => setFormat("xlsx")}
              >
                <RadioGroupItem value="xlsx" id="xlsx" />
                <FileSpreadsheet size={20} style={{ color: "var(--success-green)" }} />
                <Label htmlFor="xlsx" className="flex-1 cursor-pointer">
                  <p className="font-medium" style={{ color: "var(--dark-gray)" }}>Excel Spreadsheet (.xlsx)</p>
                  <p className="text-sm" style={{ color: "var(--mid-gray)" }}>
                    For use with other systems, data analysis
                  </p>
                </Label>
              </div>
              <div
                className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer"
                style={{ borderColor: format === "docx" ? "var(--maroon)" : "var(--border)" }}
                onClick={() => setFormat("docx")}
              >
                <RadioGroupItem value="docx" id="docx" />
                <FileText size={20} style={{ color: "var(--info-blue)" }} />
                <Label htmlFor="docx" className="flex-1 cursor-pointer">
                  <p className="font-medium" style={{ color: "var(--dark-gray)" }}>Word Document (.docx)</p>
                  <p className="text-sm" style={{ color: "var(--mid-gray)" }}>
                    Includes class list and attendance form for printing
                  </p>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleDownload} disabled={downloading} style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download size={16} className="mr-2" />}
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
