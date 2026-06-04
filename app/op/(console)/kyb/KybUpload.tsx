'use client';

/**
 * KybUpload — client island for the operator KYB page (Issue 077).
 *
 * Per doc type: pick a file → POST /api/op/kyb/upload-url { type, contentType,
 * sizeBytes } (with X-CSRF-Token) → receive { uploadUrl } → PUT the file DIRECTLY
 * to uploadUrl (no server byte-proxy — AGENTS.md 002/003) → router.refresh() so
 * the server component re-renders the doc list.
 *
 * Under STORAGE_STUB the uploadUrl points at the dev /dev/stub-storage PUT route
 * which accepts the bytes; in production it is a real signed S3 PUT URL. Either
 * way the client PUTs the raw file as the request body.
 *
 * "Submit for review" POSTs /api/op/kyb/submit (PENDING_REVIEW → UNDER_REVIEW).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { readCsrfToken } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

const DOC_TYPES = [
  { type: 'business_license', label: 'Giấy phép kinh doanh' },
  { type: 'identity', label: 'Giấy tờ tùy thân (người đại diện)' },
  { type: 'payout_account', label: 'Thông tin tài khoản nhận tiền' },
] as const;

interface DocView {
  id: string;
  type: string;
  status: string;
  uploadedAt: string;
}

interface Props {
  initialDocs: DocView[];
  status: string;
  canSubmit: boolean;
}

function describeUploadError(error: string | undefined, httpStatus: number): string {
  switch (error) {
    case 'INVALID_TYPE':
      return 'Loại giấy tờ không hợp lệ.';
    case 'INVALID_CONTENT_TYPE':
      return 'Định dạng tệp không được hỗ trợ (chỉ JPEG, PNG, WebP hoặc PDF).';
    case 'TOO_LARGE':
      return 'Tệp vượt quá giới hạn 10MB.';
    default:
      return `Tải lên thất bại (${httpStatus}).`;
  }
}

export default function KybUpload({ initialDocs, status, canSubmit }: Props) {
  const router = useRouter();
  const [busyType, setBusyType] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function uploadFile(type: string, file: File) {
    setBusyType(type);
    setMessage(null);
    setIsError(false);
    try {
      // 1) Ask the server for a signed PUT URL + persist the pointer row.
      const res = await fetch('/api/op/kyb/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': readCsrfToken(),
        },
        body: JSON.stringify({ type, contentType: file.type, sizeBytes: file.size }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setIsError(true);
        setMessage(describeUploadError(data.error, res.status));
        return;
      }
      const { uploadUrl } = (await res.json()) as { uploadUrl: string };

      // 2) PUT the bytes DIRECTLY to storage — no server proxy.
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) {
        setIsError(true);
        setMessage(`Tải tệp lên kho lưu trữ thất bại (${putRes.status}).`);
        return;
      }

      setIsError(false);
      setMessage('Đã tải giấy tờ lên.');
      router.refresh();
    } catch {
      setIsError(true);
      setMessage('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setBusyType(null);
    }
  }

  async function handleSubmitForReview() {
    setSubmitting(true);
    setMessage(null);
    setIsError(false);
    try {
      const res = await fetch('/api/op/kyb/submit', {
        method: 'POST',
        headers: { 'X-CSRF-Token': readCsrfToken() },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setIsError(true);
        setMessage(
          data.error === 'ILLEGAL_TRANSITION'
            ? 'Không thể gửi hồ sơ từ trạng thái hiện tại.'
            : `Gửi hồ sơ thất bại (${res.status}).`
        );
        return;
      }
      setIsError(false);
      setMessage('Đã gửi hồ sơ để xét duyệt.');
      router.refresh();
    } catch {
      setIsError(true);
      setMessage('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  const hasDocs = initialDocs.length > 0;

  return (
    <div className="space-y-6">
      {message ? (
        <Alert variant={isError ? 'error' : 'success'} data-testid="kyb-message">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Giấy tờ yêu cầu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {DOC_TYPES.map(({ type, label }) => (
            <div key={type} className="flex flex-col gap-1.5">
              <Label htmlFor={`kyb-file-${type}`}>{label}</Label>
              <input
                id={`kyb-file-${type}`}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                disabled={busyType !== null}
                data-testid={`kyb-file-${type}`}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadFile(type, file);
                  e.target.value = '';
                }}
                className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              />
              {busyType === type ? (
                <span className="text-xs text-muted-foreground">Đang tải lên…</span>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Giấy tờ đã nộp
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasDocs ? (
            <p className="text-sm text-muted-foreground" data-testid="kyb-empty">
              Chưa có giấy tờ nào được nộp.
            </p>
          ) : (
            <ul className="space-y-2" data-testid="kyb-doc-list">
              {initialDocs.map((doc) => {
                const meta = DOC_TYPES.find((d) => d.type === doc.type);
                return (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                    data-testid={`kyb-doc-${doc.id}`}
                  >
                    <div className="min-w-0">
                      <span className="font-medium">{meta?.label ?? doc.type}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {doc.uploadedAt.slice(0, 10)}
                      </span>
                    </div>
                    <Badge variant="neutral">{doc.status}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Trạng thái: <span className="font-mono">{status}</span>
        </p>
        <Button
          type="button"
          onClick={handleSubmitForReview}
          disabled={!canSubmit || !hasDocs || submitting}
          data-testid="kyb-submit"
        >
          {submitting ? 'Đang gửi…' : 'Gửi hồ sơ để xét duyệt'}
        </Button>
      </div>
      {!canSubmit ? (
        <p className="text-xs text-muted-foreground">
          Hồ sơ chỉ có thể gửi khi đang ở trạng thái chờ nộp (PENDING_REVIEW).
        </p>
      ) : null}
    </div>
  );
}
