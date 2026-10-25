import { ResultView } from '@/components/dnd/views/Result';

export const metadata = { title: 'Backing result' };

export default function ResultPage({ params }: { params: { id: string } }) {
  return <ResultView id={params.id} />;
}
