import { notFound } from 'next/navigation';
import { Globe, Rocket, FileText, Bug } from 'lucide-react';

interface PublicPageProps {
  params: Promise<{ workspace: string }>;
}

export default async function PublicPage({ params }: PublicPageProps) {
  const { workspace } = await params;

  let data;
  try {
    const res = await fetch(`http://localhost:3000/api/public/${workspace}`, {
      cache: 'no-store',
    });
    if (!res.ok) notFound();
    data = await res.json();
  } catch {
    // Fallback demo data if API not available
    data = {
      version: '1.0.0',
      roadmap: [],
      patchNotes: [],
      knownIssues: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Project Status</h1>
          </div>
          <p className="text-muted-foreground">
            Version {data.version} • Last updated {new Date(data.lastUpdated).toLocaleDateString()}
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Roadmap */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Rocket className="w-5 h-5 text-blue-500" /> Roadmap
          </h2>
          {data.roadmap?.length > 0 ? (
            <div className="space-y-3">
              {data.roadmap.map((item: { title: string; status: string }, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                  <span className={`w-2 h-2 rounded-full ${
                    item.status === 'done' ? 'bg-green-500' :
                    item.status === 'in-progress' ? 'bg-yellow-500' : 'bg-muted-foreground'
                  }`} />
                  <span className="text-sm">{item.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No roadmap items yet.</p>
          )}
        </section>

        {/* Patch Notes */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-500" /> Patch Notes
          </h2>
          {data.patchNotes?.length > 0 ? (
            <div className="space-y-3">
              {data.patchNotes.map((note: { date: string; text: string }, i: number) => (
                <div key={i} className="p-3 rounded-lg border">
                  <span className="text-xs text-muted-foreground">{new Date(note.date).toLocaleDateString()}</span>
                  <p className="text-sm mt-1">{note.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No patch notes yet.</p>
          )}
        </section>

        {/* Known Issues */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bug className="w-5 h-5 text-red-500" /> Known Issues
          </h2>
          {data.knownIssues?.length > 0 ? (
            <div className="space-y-3">
              {data.knownIssues.map((issue: { id: string; text: string; type: string; priority: string }) => (
                <div key={issue.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    issue.type === 'FIXME' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                  }`}>
                    {issue.type}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm">{issue.text}</p>
                    <span className="text-xs text-muted-foreground capitalize">{issue.priority} priority</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No known issues. Great work!</p>
          )}
        </section>
      </main>
    </div>
  );
}
