import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { PdfViewer } from "@/components/PdfViewer";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  BookOpen, Plus, Search, Download, Eye, Pencil, Trash2, Upload, Loader2,
  LayoutGrid, List, Image as ImageIcon, FileText, Download as DownloadIcon, X,
  Tags, Info,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Elektron Kitabxana · BE Academy" },
      { name: "description", content: "BE Academy elektron kitabxanası — kitabları oxu, önizlə və yüklə." },
      { property: "og:title", content: "Elektron Kitabxana · BE Academy" },
      { property: "og:description", content: "BE Academy elektron kitabxanası." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <LibraryPage />
    </ProtectedRoute>
  ),
});

const BUCKET = "library-books";
const ALLOWED_EXT = ["pdf", "docx", "doc", "djvu", "epub", "fb2", "mobi", "azw3"];
const IMG_EXT = ["jpg", "jpeg", "png", "webp"];

type Category = { id: string; name: string };

type Book = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  category: string | null;
  category_id: string | null;
  cover_image_url: string | null;
  file_url: string; // storage path
  file_type: string;
  file_size: number | null;
  file_name: string | null;
  uploaded_by: string | null;
  created_at: string;
};

const formatSize = (b: number | null | undefined) => {
  if (!b) return "-";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const formatDate = (d: string) => {
  const dt = new Date(d);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()}`;
};

async function signedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

function LibraryPage() {
  const { isAdmin, user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [profileNames, setProfileNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "title" | "author" | "size">("date");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [previewBook, setPreviewBook] = useState<Book | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [coverUrls, setCoverUrls] = useState<Map<string, string>>(new Map());
  const [categories, setCategories] = useState<Category[]>([]);
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [detailsBook, setDetailsBook] = useState<Book | null>(null);

  const loadCategories = async () => {
    const { data } = await supabase.from("library_categories").select("id,name").order("name");
    setCategories((data as Category[]) ?? []);
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("library_books")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const list = (data as Book[]) ?? [];
    setBooks(list);
    const ids = Array.from(new Set(list.map((b) => b.uploaded_by).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const m = new Map<string, string>();
      (profs ?? []).forEach((p: { id: string; full_name: string }) => m.set(p.id, p.full_name));
      setProfileNames(m);
    }
    // Preload signed cover urls
    const coverMap = new Map<string, string>();
    await Promise.all(
      list
        .filter((b) => b.cover_image_url)
        .map(async (b) => {
          const url = await signedUrl(b.cover_image_url!);
          if (url) coverMap.set(b.id, url);
        }),
    );
    setCoverUrls(coverMap);
    setLoading(false);
  };

  useEffect(() => { load(); loadCategories(); }, []);

  const categoryNames = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories]);

  const bookCategory = (b: Book) =>
    (b.category_id ? categoryNames.get(b.category_id) : null) ?? b.category ?? null;

  const types = useMemo(
    () => Array.from(new Set(books.map((b) => b.file_type.toLowerCase()))),
    [books],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = books.filter((b) => {
      if (categoryFilter !== "all" && b.category_id !== categoryFilter) return false;
      if (typeFilter !== "all" && b.file_type.toLowerCase() !== typeFilter) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        (b.author ?? "").toLowerCase().includes(q)
      );
    });
    arr = [...arr].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "author") return (a.author ?? "").localeCompare(b.author ?? "");
      if (sortBy === "size") return (b.file_size ?? 0) - (a.file_size ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return arr;
  }, [books, search, categoryFilter, typeFilter, sortBy]);

  const openPreview = async (b: Book) => {
    setPreviewBook(b);
    setPreviewUrl(null);
    const url = await signedUrl(b.file_url);
    setPreviewUrl(url);
  };

  const download = async (b: Book) => {
    const url = await signedUrl(b.file_url);
    if (!url) { toast.error("Yükləmə linki alınmadı"); return; }
    const a = document.createElement("a");
    a.href = url;
    a.download = b.file_name ?? `${b.title}.${b.file_type}`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const remove = async (b: Book) => {
    if (!confirm(`"${b.title}" kitabını silmək istəyirsiniz?`)) return;
    await supabase.storage.from(BUCKET).remove([b.file_url, b.cover_image_url].filter(Boolean) as string[]);
    const { error } = await supabase.from("library_books").delete().eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Silindi");
    load();
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const header = ["Başlıq", "Müəllif", "Kateqoriya", "Fayl tipi", "Ölçü", "Yükləyən", "Yüklənmə tarixi"];
    const rows: (string | number)[][] = [header];
    filtered.forEach((b) => {
      rows.push([
        b.title,
        b.author ?? "",
        bookCategory(b) ?? "",
        b.file_type.toUpperCase(),
        formatSize(b.file_size),
        profileNames.get(b.uploaded_by ?? "") ?? "",
        formatDate(b.created_at),
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 32 }, { wch: 24 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 22 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kitabxana");
    XLSX.writeFile(wb, `kitabxana_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            Elektron Kitabxana
          </h1>
          <p className="text-sm text-muted-foreground">Kitabları oxu, önizlə və yüklə.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Button variant="outline" onClick={() => setCatManagerOpen(true)}>
                <Tags className="h-4 w-4 mr-2" /> Kateqoriyalar
              </Button>
              <Button variant="outline" onClick={exportExcel}>
                <DownloadIcon className="h-4 w-4 mr-2" /> Excel
              </Button>
              <Button onClick={() => { setEditing(null); setEditorOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Yeni kitab
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Başlıq və ya müəllif üzrə axtar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Kateqoriya" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün kateqoriyalar</SelectItem>
              {categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Fayl tipi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün tiplər</SelectItem>
              {types.map((tp) => (<SelectItem key={tp} value={tp}>{tp.toUpperCase()}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Yüklənmə tarixi</SelectItem>
              <SelectItem value="title">Başlıq</SelectItem>
              <SelectItem value="author">Müəllif</SelectItem>
              <SelectItem value="size">Fayl ölçüsü</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as "cards" | "table")}>
          <TabsList>
            <TabsTrigger value="cards"><LayoutGrid className="h-4 w-4 mr-2" />Kart</TabsTrigger>
            <TabsTrigger value="table"><List className="h-4 w-4 mr-2" />Cədvəl</TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
                Hələ kitab yoxdur.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                {filtered.map((b) => (
                  <BookCard
                    key={b.id}
                    book={b}
                    categoryName={bookCategory(b)}
                    coverUrl={coverUrls.get(b.id) ?? null}
                    onPreview={() => openPreview(b)}
                    onDownload={() => download(b)}
                    onDetails={() => setDetailsBook(b)}
                    onEdit={isAdmin ? () => { setEditing(b); setEditorOpen(true); } : undefined}
                    onDelete={isAdmin ? () => remove(b) : undefined}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="table" className="mt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Başlıq</TableHead>
                    <TableHead>Müəllif</TableHead>
                    <TableHead>Kateqoriya</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Ölçü</TableHead>
                    <TableHead>Yükləyən</TableHead>
                    <TableHead>Tarix</TableHead>
                    <TableHead className="text-right">Əməliyyat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        {coverUrls.get(b.id) ? (
                          <img src={coverUrls.get(b.id)!} alt="" className="w-8 h-11 object-cover rounded-sm" />
                        ) : (
                          <div className="w-8 h-11 rounded-sm bg-muted flex items-center justify-center">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {b.title}
                          {b.description && (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button type="button" onClick={() => setDetailsBook(b)} className="text-muted-foreground hover:text-foreground">
                                    <Info className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs whitespace-pre-wrap">{b.description}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{b.author ?? "-"}</TableCell>
                      <TableCell>{bookCategory(b) ?? "-"}</TableCell>
                      <TableCell><Badge variant="secondary">{b.file_type.toUpperCase()}</Badge></TableCell>
                      <TableCell>{formatSize(b.file_size)}</TableCell>
                      <TableCell>{profileNames.get(b.uploaded_by ?? "") ?? "-"}</TableCell>
                      <TableCell>{formatDate(b.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openPreview(b)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => download(b)}><Download className="h-4 w-4" /></Button>
                          {isAdmin && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => { setEditing(b); setEditorOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => remove(b)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Kitab yoxdur.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {editorOpen && (
        <BookEditor
          book={editing}
          userId={user?.id ?? null}
          categories={categories}
          onOpenCategories={() => setCatManagerOpen(true)}
          onClose={() => setEditorOpen(false)}
          onSaved={() => { setEditorOpen(false); load(); }}
        />
      )}

      {catManagerOpen && (
        <CategoryManager
          categories={categories}
          onClose={() => setCatManagerOpen(false)}
          onChanged={() => { loadCategories(); load(); }}
        />
      )}

      <Dialog open={!!detailsBook} onOpenChange={(o) => { if (!o) setDetailsBook(null); }}>
        <DialogContent className="max-w-lg w-full">
          <DialogHeader>
            <DialogTitle>{detailsBook?.title}</DialogTitle>
            <DialogDescription>{detailsBook?.author ?? "Müəllif göstərilməyib"}</DialogDescription>
          </DialogHeader>
          {detailsBook && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                {bookCategory(detailsBook) && <Badge variant="secondary">{bookCategory(detailsBook)}</Badge>}
                <Badge variant="outline">{detailsBook.file_type.toUpperCase()}</Badge>
                <Badge variant="outline">{formatSize(detailsBook.file_size)}</Badge>
              </div>
              <div className="whitespace-pre-wrap text-muted-foreground">
                {detailsBook.description?.trim() || "Təsvir əlavə olunmayıb."}
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => { const b = detailsBook; setDetailsBook(null); openPreview(b); }}>
                  <Eye className="h-4 w-4 mr-2" />Bax
                </Button>
                <Button size="sm" variant="outline" onClick={() => download(detailsBook)}>
                  <Download className="h-4 w-4 mr-2" />Yüklə
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewBook} onOpenChange={(o) => { if (!o) { setPreviewBook(null); setPreviewUrl(null); } }}>
        <DialogContent className="max-w-5xl w-full">
          <DialogHeader>
            <DialogTitle>{previewBook?.title}</DialogTitle>
            <DialogDescription>{previewBook?.author}</DialogDescription>
          </DialogHeader>
          {previewBook?.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap border-l-2 border-primary/40 pl-3">
              {previewBook.description}
            </p>
          )}
          {previewBook && <PreviewBody book={previewBook} url={previewUrl} onDownload={() => download(previewBook)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookCard({
  book, coverUrl, onPreview, onDownload, onEdit, onDelete,
}: {
  book: Book; coverUrl: string | null;
  onPreview: () => void; onDownload: () => void;
  onEdit?: () => void; onDelete?: () => void;
}) {
  return (
    <div className="group">
      {/* Book-shaped: standing rectangle with left spine */}
      <div className="relative aspect-[2/3] rounded-r-md rounded-l-sm overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 shadow-md border border-border transition-transform group-hover:-translate-y-1 group-hover:shadow-xl">
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-primary/70 to-primary/40 rounded-l-sm" />
        {coverUrl ? (
          <img src={coverUrl} alt={book.title} className="absolute inset-0 w-full h-full object-cover pl-2" />
        ) : (
          <div className="absolute inset-0 pl-2 flex flex-col items-center justify-center text-center p-3">
            <BookOpen className="h-10 w-10 text-primary/60 mb-2" />
            <div className="text-xs font-semibold line-clamp-3">{book.title}</div>
          </div>
        )}
        <Badge className="absolute top-2 right-2 text-[10px]" variant="secondary">{book.file_type.toUpperCase()}</Badge>
      </div>
      <div className="mt-2 space-y-1">
        <div className="text-sm font-medium line-clamp-2">{book.title}</div>
        {book.author && <div className="text-xs text-muted-foreground line-clamp-1">{book.author}</div>}
      </div>
      <div className="mt-2 flex gap-1">
        <Button size="sm" variant="outline" className="flex-1 h-8" onClick={onPreview}>
          <Eye className="h-3.5 w-3.5 mr-1" />Bax
        </Button>
        <Button size="sm" variant="outline" className="flex-1 h-8" onClick={onDownload}>
          <Download className="h-3.5 w-3.5 mr-1" />Yüklə
        </Button>
        {onEdit && (
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
        )}
        {onDelete && (
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        )}
      </div>
    </div>
  );
}

function PreviewBody({ book, url, onDownload }: { book: Book; url: string | null; onDownload: () => void }) {
  const t = book.file_type.toLowerCase();
  if (!url) {
    return <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (t === "pdf") {
    return <iframe src={url} title={book.title} className="w-full h-[70vh] rounded-md border" />;
  }
  if (["jpg", "jpeg", "png", "webp"].includes(t)) {
    return <img src={url} alt={book.title} className="w-full max-h-[70vh] object-contain" />;
  }
  if (t === "docx" || t === "doc") {
    return (
      <iframe
        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
        title={book.title}
        className="w-full h-[70vh] rounded-md border"
      />
    );
  }
  return (
    <div className="py-10 text-center space-y-4">
      <FileText className="h-14 w-14 mx-auto text-muted-foreground" />
      <div>
        <div className="font-medium">Bu fayl tipi ({t.toUpperCase()}) brauzerdə önizlənmir.</div>
        <div className="text-sm text-muted-foreground">Faylı yükləyib müvafiq proqramda açın.</div>
      </div>
      <Button onClick={onDownload}><Download className="h-4 w-4 mr-2" />Yüklə</Button>
    </div>
  );
}

function BookEditor({
  book, userId, categories, onOpenCategories, onClose, onSaved,
}: {
  book: Book | null; userId: string | null;
  categories: Category[]; onOpenCategories: () => void;
  onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(book?.title ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
  const [description, setDescription] = useState(book?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(book?.category_id ?? null);
  const [catSearch, setCatSearch] = useState("");
  const [filePath, setFilePath] = useState(book?.file_url ?? "");
  const [fileType, setFileType] = useState(book?.file_type ?? "");
  const [fileSize, setFileSize] = useState<number | null>(book?.file_size ?? null);
  const [fileName, setFileName] = useState<string | null>(book?.file_name ?? null);
  const [coverPath, setCoverPath] = useState<string | null>(book?.cover_image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const uploadBook = async (f: File) => {
    const ext = (f.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) { toast.error(`Dəstəklənməyən format. İcazə: ${ALLOWED_EXT.join(", ").toUpperCase()}`); return; }
    if (f.size > 500 * 1024 * 1024) { toast.error("Fayl 500MB-dan kiçik olmalıdır"); return; }
    setUploading(true);
    const path = `books/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type, upsert: false });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    setFilePath(path); setFileType(ext); setFileSize(f.size); setFileName(f.name);
    toast.success("Fayl yükləndi");
  };

  const uploadCover = async (f: File) => {
    const ext = (f.name.split(".").pop() ?? "").toLowerCase();
    if (!IMG_EXT.includes(ext)) { toast.error("Yalnız JPG, PNG, WEBP"); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error("Şəkil 10MB-dan kiçik olmalıdır"); return; }
    setCoverUploading(true);
    const path = `covers/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type, upsert: false });
    setCoverUploading(false);
    if (error) { toast.error(error.message); return; }
    setCoverPath(path);
    toast.success("Kover yükləndi");
  };

  const save = async () => {
    if (!title.trim()) { toast.error("Başlıq daxil edin"); return; }
    if (!filePath) { toast.error("Fayl yükləyin"); return; }
    setSaving(true);
    const payload = {
      title: title.trim(),
      author: author.trim() || null,
      description: description.trim() || null,
      category: category.trim() || null,
      cover_image_url: coverPath,
      file_url: filePath,
      file_type: fileType,
      file_size: fileSize,
      file_name: fileName,
      uploaded_by: userId,
    };
    const { error } = book
      ? await supabase.from("library_books").update(payload).eq("id", book.id)
      : await supabase.from("library_books").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(book ? "Yeniləndi" : "Yaradıldı");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>{book ? "Kitabı redaktə et" : "Yeni kitab"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Başlıq *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Müəllif</Label>
              <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Kateqoriya</Label>
                <button type="button" className="text-xs text-primary hover:underline" onClick={onOpenCategories}>
                  İdarə et
                </button>
              </div>
              <Select value={categoryId ?? "none"} onValueChange={(v) => setCategoryId(v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Kateqoriya seç" /></SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      value={catSearch}
                      onChange={(e) => setCatSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="Axtar..."
                      className="h-8"
                    />
                  </div>
                  <SelectItem value="none">Kateqoriyasız</SelectItem>
                  {categories
                    .filter((c) => c.name.toLowerCase().includes(catSearch.trim().toLowerCase()))
                    .map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Təsvir</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Üz şəkli</Label>
              <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ""; }} />
              {coverPath ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate flex-1">Kover yükləndi</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setCoverPath(null)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" className="w-full" disabled={coverUploading} onClick={() => coverRef.current?.click()}>
                  {coverUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {coverUploading ? "Yüklənir..." : "Kover yüklə"}
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Kitab faylı *</Label>
              <input ref={fileRef} type="file" accept={ALLOWED_EXT.map((e) => `.${e}`).join(",")} className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBook(f); e.target.value = ""; }} />
              {filePath ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{fileType.toUpperCase()}</Badge>
                  <span className="truncate flex-1">{fileName ?? "Fayl yükləndi"}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => { setFilePath(""); setFileType(""); setFileSize(null); setFileName(null); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" className="w-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {uploading ? "Yüklənir..." : `Fayl yüklə (${ALLOWED_EXT.map((e) => e.toUpperCase()).join(", ")})`}
                </Button>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Ləğv et</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Yadda saxla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
