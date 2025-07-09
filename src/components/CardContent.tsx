import React from 'react';

interface CardContentProps {
  content: string;
  className?: string;
}

const CardContent: React.FC<CardContentProps> = ({ content, className }) => {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

export default CardContent;