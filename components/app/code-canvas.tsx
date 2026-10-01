"use client";

import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  RefreshCcwIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Artifact,
  ArtifactAction,
  ArtifactActions,
  ArtifactClose,
  ArtifactContent,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { composeSrcDoc } from "@/lib/canvas";

export function CodeCanvas({
  code,
  onClose,
}: {
  code: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  // Bump to force-remount the iframe (re-runs scripts)
  const [runId, setRunId] = useState(0);
  const srcDoc = composeSrcDoc(code);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const openInNewTab = () => {
    const blob = new Blob([srcDoc], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank", "noopener");
  };

  return (
    <Artifact className="flex h-full flex-col rounded-none border-y-0 border-e-0">
      <Tabs className="flex h-full flex-col gap-0" defaultValue="preview">
        <ArtifactHeader className="gap-2">
          <ArtifactTitle className="font-heading text-xs">بوم</ArtifactTitle>
          <TabsList className="h-7" variant="glass">
            <TabsTrigger className="text-xs" value="preview">
              پیش‌نمایش
            </TabsTrigger>
            <TabsTrigger className="text-xs" value="code">
              کد
            </TabsTrigger>
          </TabsList>
          <ArtifactActions>
            <ArtifactAction
              icon={RefreshCcwIcon}
              label="اجرای دوباره"
              onClick={() => setRunId((n) => n + 1)}
              tooltip="اجرای دوباره پیش‌نمایش"
            />
            <ArtifactAction
              icon={copied ? CheckIcon : CopyIcon}
              label="کپی کد"
              onClick={() => {
                navigator.clipboard.writeText(code);
                setCopied(true);
              }}
              tooltip="کپی کد"
            />
            <ArtifactAction
              icon={ExternalLinkIcon}
              label="باز کردن در زبانه جدید"
              onClick={openInNewTab}
              tooltip="باز کردن در زبانه جدید"
            />
            <ArtifactClose onClick={onClose} />
          </ArtifactActions>
        </ArtifactHeader>
        <ArtifactContent className="flex-1 overflow-hidden p-0">
          <TabsContent className="h-full" value="preview">
            {/* allow-scripts only — model-generated code must never get
                allow-same-origin */}
            <iframe
              className="h-full w-full border-0 bg-white"
              key={runId}
              sandbox="allow-scripts"
              srcDoc={srcDoc}
              title="پیش‌نمایش بوم"
            />
          </TabsContent>
          <TabsContent
            className="h-full overflow-auto text-start"
            dir="ltr"
            value="code"
          >
            <CodeBlock code={code} language="html" showLineNumbers />
          </TabsContent>
        </ArtifactContent>
      </Tabs>
    </Artifact>
  );
}
