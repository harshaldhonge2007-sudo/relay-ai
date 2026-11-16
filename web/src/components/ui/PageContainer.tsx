import React from "react";

export type ContainerWidth = "reading" | "standard" | "wide";

interface PageContainerProps {
  children: React.ReactNode;
  width?: ContainerWidth;
  className?: string;
}

export function PageContainer({
  children,
  width = "standard",
  className = "",
}: PageContainerProps) {
  let maxWidthClass = "max-w-standard"; // 1120px default
  if (width === "reading") {
    maxWidthClass = "max-w-reading"; // 760px
  } else if (width === "wide") {
    maxWidthClass = "max-w-wide"; // 1360px
  }

  return (
    <div className={`w-full ${maxWidthClass} space-y-6 pb-16 ${className}`}>
      {children}
    </div>
  );
}

export default PageContainer;

