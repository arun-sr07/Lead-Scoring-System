import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const API_BASE = 'http://localhost:3001';

export default function Index() {
  const { toast } = useToast();
  const [offerName, setOfferName] = useState('');
  const [valueProps, setValueProps] = useState('');
  const [useCases, setUseCases] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const createOffer = async () => {
    if (!offerName || !valueProps || !useCases) {
      toast({ title: 'Missing fields', description: 'Please fill all offer fields', variant: 'destructive' });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: offerName,
          value_props: valueProps.split(',').map(v => v.trim()),
          ideal_use_cases: useCases.split(',').map(u => u.trim())
        })
      });

      if (!res.ok) throw new Error('Failed to create offer');
      
      toast({ title: 'Offer created', description: 'Successfully created offer' });
      setOfferName('');
      setValueProps('');
      setUseCases('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const uploadLeads = async () => {
    if (!csvFile) {
      toast({ title: 'No file', description: 'Please select a CSV file', variant: 'destructive' });
      return;
    }

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const res = await fetch(`${API_BASE}/leads/upload`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Failed to upload leads');
      
      const data = await res.json();
      toast({ title: 'Leads uploaded', description: `${data.count} leads uploaded successfully` });
      setCsvFile(null);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const runScoring = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/score`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to score leads');
      
      const data = await res.json();
      toast({ title: 'Scoring complete', description: `Scored ${data.count} leads` });
      
      // Fetch results
      const resultsRes = await fetch(`${API_BASE}/results`);
      const resultsData = await resultsRes.json();
      setResults(resultsData);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const exportResults = () => {
    window.open(`${API_BASE}/results/export`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Lead Scoring System
          </h1>
          <p className="text-muted-foreground text-lg">AI-powered lead qualification with Groq Llama</p>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Create Offer */}
          <Card className="p-6 space-y-4 bg-card/50 backdrop-blur border-primary/10 shadow-glow">
            <h2 className="text-2xl font-semibold text-foreground">Create Offer</h2>
            
            <div className="space-y-2">
              <Label htmlFor="offer-name">Offer Name</Label>
              <Input 
                id="offer-name"
                value={offerName}
                onChange={(e) => setOfferName(e.target.value)}
                placeholder="AI Sales Assistant Pro"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="value-props">Value Propositions (comma-separated)</Label>
              <Textarea
                id="value-props"
                value={valueProps}
                onChange={(e) => setValueProps(e.target.value)}
                placeholder="Automate follow-ups, Increase conversions, CRM integration"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="use-cases">Ideal Use Cases (comma-separated)</Label>
              <Textarea
                id="use-cases"
                value={useCases}
                onChange={(e) => setUseCases(e.target.value)}
                placeholder="B2B SaaS, Sales teams, High-volume outbound"
                rows={3}
              />
            </div>

            <Button onClick={createOffer} className="w-full">Create Offer</Button>
          </Card>

          {/* Upload Leads */}
          <Card className="p-6 space-y-4 bg-card/50 backdrop-blur border-primary/10 shadow-glow">
            <h2 className="text-2xl font-semibold text-foreground">Upload Leads</h2>
            
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              />
              <p className="text-sm text-muted-foreground">
                Required columns: name, role, company, industry, location, linkedin_bio
              </p>
            </div>

            <Button onClick={uploadLeads} disabled={!csvFile} className="w-full">
              Upload Leads
            </Button>

            <div className="pt-4 border-t border-border/50">
              <Button 
                onClick={runScoring} 
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
              >
                {loading ? 'Scoring...' : 'Run Scoring'}
              </Button>
            </div>
          </Card>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <Card className="p-6 space-y-4 bg-card/50 backdrop-blur border-primary/10 shadow-glow">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-foreground">Results ({results.length})</h2>
              <Button onClick={exportResults} variant="outline">Export CSV</Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left">
                    <th className="pb-3 font-semibold">Name</th>
                    <th className="pb-3 font-semibold">Role</th>
                    <th className="pb-3 font-semibold">Company</th>
                    <th className="pb-3 font-semibold">Intent</th>
                    <th className="pb-3 font-semibold">Score</th>
                    <th className="pb-3 font-semibold">Reasoning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {results.map((result, idx) => (
                    <tr key={idx} className="hover:bg-accent/5 transition-colors">
                      <td className="py-3">{result.name}</td>
                      <td className="py-3 text-muted-foreground">{result.role}</td>
                      <td className="py-3">{result.company}</td>
                      <td className="py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          result.intent === 'High' ? 'bg-green-500/20 text-green-300' :
                          result.intent === 'Medium' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-red-500/20 text-red-300'
                        }`}>
                          {result.intent}
                        </span>
                      </td>
                      <td className="py-3 font-semibold">{result.score}</td>
                      <td className="py-3 text-muted-foreground text-xs max-w-xs truncate" title={result.reasoning}>
                        {result.reasoning}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
