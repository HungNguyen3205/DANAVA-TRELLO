import React from 'react';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-muted-foreground">Tính năng đang được phát triển.</p>
      </div>
    </div>
  );
}
