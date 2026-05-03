import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Plus, Loader2, Trash2, BookOpen, Dumbbell, FileQuestion,
  GraduationCap, Save, Video, FileText, FileType, Link as LinkIcon, Pencil, Play,
} from "lucide-react";
import { toast } from "sonner";
import { FileUpload } from "@/components/FileUpload";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/courses/$courseId/")({
  component: () => (
    <ProtectedRoute>
      <CourseBuilderPage />
    </ProtectedRoute>
  ),
});

interface Course {
  id: string;
  title: string;
  description: string | null;
  passing_score: number;
  is_published: boolean;
  certificate_template_url: string | null;
  cover_image_url: string | null;
}

type BlockType = "lesson" | "practice" | "quiz" | "final_exam";

interface Block {
  id: string;
  course_id: string;
  block_type: BlockType;
  title: string;
  description: string | null;
  position: number;
  video_url: string | null;
  external_video_url: string | null;
  pdf_url: string | null;
  pptx_url: string | null;
  docx_url: string | null;
  time_limit_seconds: number | null;
  passing_score: number | null;
}

const blockMeta: Record<BlockType, { icon: typeof BookOpen; label: string; tone: string }> = {
  lesson: { icon: BookOpen, label: "Dərs", tone: "bg-primary/10 text-primary" },
  practice: { icon: Dumbbell, label: "Məşq", tone: "bg-accent text-accent-foreground" },
  quiz: { icon: FileQuestion, label: "Quiz", tone: "bg-warning/15 text-warning-foreground" },
  final_exam: { icon: GraduationCap, label: "Son imtahan", tone: "bg-success/15 text-success" },
};

function CourseBuilderPage() {
  const { courseId } = Route.useParams();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("details");
  const [savingDetails, setSavingDetails] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: b }] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).single(),
      supabase.from("course_blocks").select("*").eq("course_id", courseId).order("position"),
    ]);
    setCourse(c as Course);
    setBlocks((b ?? []) as Block[]);
    setLoading(false);
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const updateCourseField = (patch: Partial<Course>) => {
    setCourse((c) => (c ? { ...c, ...patch } : c));
  };

  const saveDetails = async () => {
    if (!course) return;
    setSavingDetails(true);
    const { error } = await supabase
      .from("courses")
      .update({
        title: course.title,
        description: course.description,
        passing_score: course.passing_score,
        is_published: course.is_published,
        cover_image_url: course.cover_image_url,
      })
      .eq("id", course.id);
    setSavingDetails(false);
    if (error) toast.error(error.message);
    else toast.success("Yadda saxlanıldı");
  };

  const addBlock = async (type: BlockType) => {
    const position = blocks.length;
    const defaults: Record<BlockType, Partial<Block>> = {
      lesson: { title: "New Lesson" },
      practice: { title: "New Practice", time_limit_seconds: 30 },
      quiz: { title: "New Quiz", time_limit_seconds: 30 },
      final_exam: { title: "Final Exam", passing_score: 60 },
    };
    const insertRow = { course_id: courseId, block_type: type, position, title: defaults[type].title ?? "Untitled", ...defaults[type] };
    const { data, error } = await supabase
      .from("course_blocks")
      .insert(insertRow)
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setBlocks((b) => [...b, data as Block]);
    toast.success(`${blockMeta[type].label} əlavə olundu`);
  };

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const saveBlock = async (block: Block) => {
    const { error } = await supabase
      .from("course_blocks")
      .update({
        title: block.title,
        description: block.description,
        video_url: block.video_url,
        external_video_url: block.external_video_url,
        pdf_url: block.pdf_url,
        pptx_url: block.pptx_url,
        docx_url: block.docx_url,
        time_limit_seconds: block.time_limit_seconds,
        passing_score: block.passing_score,
      })
      .eq("id", block.id);
    if (error) toast.error(error.message);
    else toast.success("Yadda saxlanıldı");
  };

  const deleteBlock = async (id: string) => {
    const { error } = await supabase.from("course_blocks").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    toast.success("Silindi");
  };

  if (loading || !course) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const lessonBlocks = blocks.filter((b) => b.block_type === "lesson" || b.block_type === "practice");
  const examBlock = blocks.find((b) => b.block_type === "final_exam");

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <button
        onClick={() => navigate({ to: "/courses" })}
        className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" /> {t.courses.backToCourses}
      </button>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">{course.title}</h1>
          <p className="text-muted-foreground mt-1">
            {blocks.length} {blocks.length === 1 ? t.courses.block : t.courses.blocks} ·{" "}
            <span className={course.is_published ? "text-success" : ""}>
              {course.is_published ? t.common.published : t.common.draft}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button
              variant="destructive"
              onClick={async () => {
                if (!confirm(t.courseExtras.confirmDelete)) return;
                const { error } = await supabase.from("courses").delete().eq("id", course.id);
                if (error) { toast.error(error.message); return; }
                toast.success("Silindi");
                navigate({ to: "/courses" });
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" /> {t.courseExtras.delete}
            </Button>
          )}
          <Button asChild variant="default">
            <Link to="/courses/$courseId/play" params={{ courseId: course.id }}>
              <Play className="h-4 w-4 mr-2" /> {t.courses.coursePlayer}
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="details">{t.courses.details}</TabsTrigger>
          <TabsTrigger value="lessons">{t.courses.lessons}</TabsTrigger>
          <TabsTrigger value="exam">{t.courses.finalExam}</TabsTrigger>
          <TabsTrigger value="certificate">{t.courses.certificate}</TabsTrigger>
        </TabsList>

        {/* DETAILS */}
        <TabsContent value="details" className="space-y-4">
          <Card className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>{t.courses.title_field}</Label>
              <Input
                value={course.title}
                onChange={(e) => updateCourseField({ title: e.target.value })}
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.courses.description}</Label>
              <Textarea
                value={course.description ?? ""}
                onChange={(e) => updateCourseField({ description: e.target.value })}
                rows={4}
                disabled={!isAdmin}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.courses.passingScore}</Label>
                <Input
                  type="number" min={0} max={100}
                  value={course.passing_score}
                  onChange={(e) => updateCourseField({ passing_score: Number(e.target.value) })}
                  disabled={!isAdmin}
                />
              </div>
              <div className="flex items-center gap-3 pt-7">
                <Switch
                  checked={course.is_published}
                  onCheckedChange={(v) => updateCourseField({ is_published: v })}
                  disabled={!isAdmin}
                />
                <Label>{t.courses.publishedSwitch}</Label>
              </div>
            </div>
            <FileUpload
              label="Üz şəkli (kart şəkli)"
              icon={FileText}
              value={course.cover_image_url}
              onChange={(v) => updateCourseField({ cover_image_url: v })}
              accept="image/*"
              folder="covers"
              disabled={!isAdmin}
            />
            {isAdmin && (
              <div className="flex justify-end pt-2">
                <Button onClick={saveDetails} disabled={savingDetails}>
                  {savingDetails ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {t.courses.saveDetails}
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* LESSONS & PRACTICE */}
        <TabsContent value="lessons" className="space-y-3">
          {lessonBlocks.length === 0 && (
            <Card className="p-10 text-center border-dashed">
              <p className="text-sm text-muted-foreground">{t.courses.noLessons}</p>
            </Card>
          )}
          {lessonBlocks.map((b) => (
            <BlockCard key={b.id} block={b} isAdmin={isAdmin} onChange={(p) => updateBlock(b.id, p)} onSave={() => saveBlock(b)} onDelete={() => deleteBlock(b.id)} />
          ))}
          {isAdmin && (
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => addBlock("lesson")}>
                <Plus className="h-4 w-4 mr-1" /> {t.courses.addLesson}
              </Button>
              <Button variant="outline" onClick={() => addBlock("practice")}>
                <Plus className="h-4 w-4 mr-1" /> {t.courses.addPractice}
              </Button>
            </div>
          )}
        </TabsContent>


        {/* FINAL EXAM */}
        <TabsContent value="exam" className="space-y-3">
          {!examBlock ? (
            <Card className="p-10 text-center border-dashed space-y-4">
              <p className="text-sm text-muted-foreground">{t.courses.noFinalExam}</p>
              {isAdmin && (
                <Button onClick={() => addBlock("final_exam")}>
                  <Plus className="h-4 w-4 mr-1" /> {t.courses.addFinalExam}
                </Button>
              )}
            </Card>
          ) : (
            <BlockCard block={examBlock} isAdmin={isAdmin} onChange={(p) => updateBlock(examBlock.id, p)} onSave={() => saveBlock(examBlock)} onDelete={() => deleteBlock(examBlock.id)} />
          )}
        </TabsContent>

        {/* CERTIFICATE */}
        <TabsContent value="certificate">
          <Card className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-semibold">Sertifikat şablonu</h3>
                <p className="text-sm text-muted-foreground">
                  Bu kursa aid PDF və ya şəkil şablonunu yükləyin. Yer tutucular: <code>{"{{FULL_NAME}}"}</code>,{" "}
                  <code>{"{{COURSE_TITLE}}"}</code>, <code>{"{{SCORE}}"}</code>, <code>{"{{ISSUE_DATE}}"}</code>,{" "}
                  <code>{"{{SERIAL}}"}</code>.
                </p>
              </div>
            </div>
            <FileUpload
              label="Sertifikat şablonu (PDF / şəkil)"
              icon={FileText}
              value={course.certificate_template_url}
              onChange={(v) => updateCourseField({ certificate_template_url: v })}
              accept=".pdf,application/pdf,image/*"
              folder="certificate-templates"
              disabled={!isAdmin}
            />
            {isAdmin && (
              <div className="flex justify-end">
                <Button
                  onClick={async () => {
                    const { error } = await supabase
                      .from("courses")
                      .update({ certificate_template_url: course.certificate_template_url })
                      .eq("id", course.id);
                    if (error) toast.error(error.message);
                    else toast.success("Yadda saxlanıldı");
                  }}
                >
                  <Save className="h-4 w-4 mr-2" /> Yadda saxla
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BlockCard({
  block, isAdmin, onChange, onSave, onDelete,
}: {
  block: Block;
  isAdmin: boolean;
  onChange: (p: Partial<Block>) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const meta = blockMeta[block.block_type];
  const Icon = meta.icon;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave();
    setSaving(false);
    setEditing(false);
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${meta.tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{meta.label}</div>
          <div className="font-medium truncate">{block.title}</div>
        </div>
        {isAdmin && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => setEditing((e) => !e)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </div>
      {editing && (
        <div className="border-t px-4 py-5 space-y-4 bg-muted/30">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={block.title} onChange={(e) => onChange({ title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={block.description ?? ""}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={3}
            />
          </div>
          {block.block_type === "lesson" && (
            <div className="grid sm:grid-cols-2 gap-3">
              <FileField label="External video URL (YouTube, Vimeo)" icon={LinkIcon} value={block.external_video_url} onChange={(v) => onChange({ external_video_url: v })} />
              <FileUpload label="Video" icon={Video} value={block.video_url} onChange={(v) => onChange({ video_url: v })} accept="video/*" folder="videos" />
              <FileUpload label="PDF" icon={FileText} value={block.pdf_url} onChange={(v) => onChange({ pdf_url: v })} accept="application/pdf" folder="pdfs" />
              <FileUpload label="PPTX" icon={FileType} value={block.pptx_url} onChange={(v) => onChange({ pptx_url: v })} accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" folder="pptx" />
              <FileUpload label="DOCX" icon={FileType} value={block.docx_url} onChange={(v) => onChange({ docx_url: v })} accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" folder="docx" />
            </div>
          )}
          {(block.block_type === "practice" || block.block_type === "quiz") && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Time per question (seconds)</Label>
                <Input
                  type="number"
                  value={block.time_limit_seconds ?? ""}
                  onChange={(e) => onChange({ time_limit_seconds: Number(e.target.value) || null })}
                />
              </div>
            </div>
          )}
          {block.block_type === "final_exam" && (
            <div className="space-y-2">
              <Label>Passing score (%)</Label>
              <Input
                type="number" min={0} max={100}
                value={block.passing_score ?? 60}
                onChange={(e) => onChange({ passing_score: Number(e.target.value) })}
              />
            </div>
          )}
          {(block.block_type === "practice" || block.block_type === "quiz" || block.block_type === "final_exam") && (
            <QuestionsEditor blockId={block.id} />
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function FileField({
  label, icon: Icon, value, onChange,
}: { label: string; icon: typeof Video; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {label}</Label>
      <Input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder="https://..."
      />
    </div>
  );
}

interface Question {
  id: string;
  text: string;
  position: number;
  answers: { id: string; text: string; is_correct: boolean; position: number }[];
}

function QuestionsEditor({ blockId }: { blockId: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [answers, setAnswers] = useState<{ text: string; is_correct: boolean }[]>([
    { text: "", is_correct: true },
    { text: "", is_correct: false },
    { text: "", is_correct: false },
  ]);

  const load = useCallback(async () => {
    const { data: qs } = await supabase
      .from("questions").select("id,text,position").eq("block_id", blockId).order("position");
    if (!qs) { setQuestions([]); return; }
    const ids = qs.map((q) => q.id);
    const { data: ans } = ids.length
      ? await supabase.from("answers").select("id,text,is_correct,position,question_id").in("question_id", ids).order("position")
      : { data: [] };
    setQuestions(qs.map((q) => ({
      ...q,
      answers: (ans ?? []).filter((a: { question_id: string }) => a.question_id === q.id) as Question["answers"],
    })));
  }, [blockId]);

  useEffect(() => { load(); }, [load]);

  const addQuestion = async () => {
    if (!text.trim() || answers.filter((a) => a.text.trim()).length < 2) {
      toast.error("Need question text and at least 2 answers"); return;
    }
    if (!answers.some((a) => a.is_correct)) {
      toast.error("Mark at least one correct answer"); return;
    }
    const { data: q, error } = await supabase
      .from("questions").insert({ block_id: blockId, text: text.trim(), position: questions.length })
      .select().single();
    if (error || !q) { toast.error(error?.message ?? "Failed"); return; }
    const valid = answers.filter((a) => a.text.trim());
    const { error: aErr } = await supabase.from("answers").insert(
      valid.map((a, i) => ({ question_id: q.id, text: a.text.trim(), is_correct: a.is_correct, position: i })),
    );
    if (aErr) { toast.error(aErr.message); return; }
    toast.success("Question added");
    setText(""); setAnswers([
      { text: "", is_correct: true }, { text: "", is_correct: false }, { text: "", is_correct: false },
    ]);
    setOpen(false);
    load();
  };

  const removeQuestion = async (id: string) => {
    await supabase.from("questions").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Questions ({questions.length})</Label>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" /> Add Question</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New question</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Question text</Label>
                <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Answers (mark correct ones)</Label>
                {answers.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={a.is_correct}
                      onChange={(e) => {
                        const next = [...answers]; next[idx] = { ...a, is_correct: e.target.checked }; setAnswers(next);
                      }}
                      className="h-4 w-4"
                    />
                    <Input
                      value={a.text}
                      onChange={(e) => {
                        const next = [...answers]; next[idx] = { ...a, text: e.target.value }; setAnswers(next);
                      }}
                      placeholder={`Answer ${idx + 1}`}
                    />
                    {answers.length > 2 && (
                      <Button variant="ghost" size="icon" onClick={() => setAnswers(answers.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => setAnswers([...answers, { text: "", is_correct: false }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add answer
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={addQuestion}>Save question</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-md border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm"><span className="text-muted-foreground mr-1.5">Q{i + 1}.</span>{q.text}</div>
              <Button variant="ghost" size="icon" onClick={() => removeQuestion(q.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
            <div className="mt-2 space-y-1">
              {q.answers.map((a) => (
                <div key={a.id} className={`text-xs px-2 py-1 rounded ${a.is_correct ? "bg-success/10 text-success" : "text-muted-foreground"}`}>
                  {a.is_correct ? "✓ " : "○ "}{a.text}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// silence unused-import lint for Link in this file
void Link;
