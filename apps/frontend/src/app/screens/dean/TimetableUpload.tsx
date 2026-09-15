import { ArrowRight, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { api, BASE_URL } from "../../../lib/api";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Label } from "../../components/ui/label";

interface AcademicYear { id: number; name: string; status: string }

export function TimetableUpload() {
  const navigate = useNavigate();
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const years = await api.get<any>("/api/v1/academics/academic-years");
        const list: AcademicYear[] = Array.isArray(years) ? years : years.data ?? [];
        const active = list.find((y) => y.status === "active") ?? null;
        setActiveYear(active);
      } catch {
        toast.error('Failed to load academic years');
      }
    })();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile || !activeYear) {
      toast.error('Select an active academic year and a file');
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await fetch(`${BASE_URL}/api/v1/academics/timetable/upload?academic_year_id=${activeYear.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Upload failed (${res.status})`);
      }
      const body = await res.json();
      toast.success(body.message || 'Upload successful');
      setTimeout(() => navigate('/dean/timetable/view'), 600);
    } catch (err: any) {
      setError(err.message ?? 'Upload failed');
      toast.error(err.message ?? 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Timetable Upload</h1>
        <p className="text-sm mt-1">Upload an Excel workbook (.xlsx) containing one sheet per class. The server will parse each sheet into a canonical JSON view and make it available for download and per-teacher filtering.</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div>
            <Label>Active Academic Year</Label>
            <div className="mt-2">{activeYear ? `${activeYear.name}` : <span style={{ color: 'var(--danger-red)' }}>No active year</span>}</div>
          </div>

          <div className="mt-4">
            <Label>Upload Excel File</Label>
            <div className="mt-2 border-2 border-dashed rounded-lg p-12 text-center cursor-pointer" onClick={() => document.getElementById('timetable-file')?.click()}>
              <input id="timetable-file" type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
              {selectedFile ? (
                <div>
                  <FileSpreadsheet size={48} className="mx-auto" />
                  <p className="font-medium">{selectedFile.name}</p>
                </div>
              ) : (
                <div>
                  <Upload size={48} className="mx-auto" />
                  <p className="font-medium">Drop your timetable workbook here or click to browse</p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 text-sm text-red-600 flex items-center gap-2"><XCircle />{error}</div>
          )}

          <Button onClick={handleUpload} disabled={!selectedFile || !activeYear || isUploading} className="w-full mt-6">
            {isUploading ? <Loader2 className="animate-spin mr-2" /> : <ArrowRight className="mr-2" />} Upload
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
