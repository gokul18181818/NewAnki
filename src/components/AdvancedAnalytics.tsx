import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Sankey,
} from 'recharts';

export interface AnalyticsData {
  learningCompletionRates: number[]; // [step1_rate, step2_rate]
  stateTransitionHeatmap: any[][]; // TODO detailed type
  retentionForecasting: {
    predicted30Day: number;
    predicted90Day: number;
    recommendedIntervals: number[];
  };
  performanceOptimization: {
    suggestedEaseAdjustment: number;
    suggestedLearningSteps: number[];
    confidenceScore: number;
  };
  transitionMatrix: { from: string; to: string; count: number; }[];
  retentionBuckets: { interval_bucket: string; retention: number; reviews: number; lapses: number; }[];
}

interface AdvancedAnalyticsProps {
  deckId: string;
}

const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({ deckId }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitions, setTransitions] = useState<{ from: string; to: string; count: number; }[]>([]);
  const [buckets, setBuckets] = useState<{ interval_bucket: string; retention: number; reviews: number; lapses: number; }[]>([]);

  // Build datasets – keep hooks outside conditional returns to preserve order
  const sankeyData = useMemo(() => {
    const nodes: { name: string }[] = [];
    const nodeIndex = (name: string) => {
      let idx = nodes.findIndex(n => n.name === name);
      if (idx === -1) idx = nodes.push({ name }) - 1;
      return idx;
    };
    const links = transitions.map(t => ({
      source: nodeIndex(t.from),
      target: nodeIndex(t.to),
      value: t.count,
    }));
    return { nodes, links };
  }, [transitions]);

  const retentionChartData = useMemo(() => {
    const order = ['1', '3', '7', '15', '30+'];
    return buckets
      .slice()
      .sort((a, b) => order.indexOf(a.interval_bucket) - order.indexOf(b.interval_bucket))
      .map(b => ({ interval: b.interval_bucket, retention: b.retention }));
  }, [buckets]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [{ data: analytics, error: aErr }, { data: tData, error: tErr }, { data: rData, error: rErr }] = await Promise.all([
          supabase.rpc('deck_analytics', { p_deck_id: deckId }),
          supabase.rpc('deck_transition_matrix', { p_deck_id: deckId }),
          supabase.rpc('deck_retention_buckets_json', { p_deck_id: deckId }),
        ]);

        if (aErr) throw aErr;
        if (tErr) throw tErr;
        if (rErr) throw rErr;

        setData(analytics as AnalyticsData);
        setTransitions((tData || []) as { from: string; to: string; count: number }[]);
        setBuckets((rData as any[] | undefined) as { interval_bucket: string; retention: number; reviews: number; lapses: number }[] || []);
      } catch (e) {
        setError('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [deckId]);

  if (loading) return <div className="p-4">Loading analytics…</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!data) return <div className="p-4">Fetching summary…</div>;

  const funnelData = [
    { step: 'Step 1', completion: data.learningCompletionRates[0] },
    { step: 'Step 2', completion: data.learningCompletionRates[1] },
  ];

  return (
    <div className="space-y-6">
      <section className="bg-white shadow rounded p-4">
        <h2 className="font-semibold mb-2">Learning Completion Funnel</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={funnelData}>
            <XAxis dataKey="step" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Bar dataKey="completion" fill="#6366F1" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* State Transition Flow */}
      <section className="bg-white shadow rounded p-4">
        <h2 className="font-semibold mb-2">State Transition Flow</h2>
        <ResponsiveContainer width="100%" height={300}>
          {sankeyData.links.length > 0 ? (
            // @ts-ignore – Sankey typings may be missing in local d.ts shim
            <Sankey
              dataKey="value"
              node={{ stroke: '#8884d8' }}
              link={{ stroke: '#bbb' }}
              nodes={sankeyData.nodes}
              links={sankeyData.links}
            />
          ) : (
            <BarChart data={[{ name: 'No transitions yet', value: 1 }]}>
              <XAxis hide dataKey="name" />
              <Bar dataKey="value" fill="#CBD5E1" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </section>

      {/* Retention by Interval */}
      <section className="bg-white shadow rounded p-4">
        <h2 className="font-semibold mb-2">Retention by Interval (last 90d)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={retentionChartData}>
            <XAxis dataKey="interval" />
            <YAxis domain={[0, 100]} />
            <Tooltip formatter={(v: any) => `${v}%`} />
            <Bar dataKey="retention" fill="#4ade80" />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
};

export default AdvancedAnalytics; 