import React from 'react';

interface QuestionFormatterProps {
  content: string;
  className?: string;
}

const QuestionFormatter: React.FC<QuestionFormatterProps> = ({ content, className }) => {
  // Regex to split by A., B., C., etc., ensuring it's at the start of a line or preceded by a space
  const options = content.split(/(?=\s[A-Z]\.)/).map(s => s.trim());

  // The first element is the question itself
  const question = options.shift();

  return (
    <div className={className}>
      {question && (
        <div
          className="mb-4"
          dangerouslySetInnerHTML={{ __html: question }}
        />
      )}
      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={index} dangerouslySetInnerHTML={{ __html: option }} />
        ))}
      </div>
    </div>
  );
};

export default QuestionFormatter;