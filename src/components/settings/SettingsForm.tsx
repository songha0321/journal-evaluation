"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Dropdown } from "@/components/ui/Dropdown";
import { Avatar } from "@/components/ui/Avatar";
import { PRESETS, DEFAULT_POINT, applyPoint, isHex, palette } from "@/lib/theme";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "@/lib/settings";
import type { CurrentUser } from "@/lib/roles";

const CUSTOM = "__custom";

export function SettingsForm({ user }: { user: CurrentUser }) {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [hex, setHex] = useState(DEFAULT_POINT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loaded = loadSettings();
    setS(loaded);
    setHex(loaded.point);
    setReady(true);
  }, []);

  function update(patch: Partial<Settings>) {
    const next = { ...s, ...patch };
    setS(next);
    saveSettings(next);
    if (patch.point) applyPoint(patch.point);
    if (patch.sidebar) {
      try {
        localStorage.setItem("hj.sidebar.collapsed", patch.sidebar === "collapsed" ? "1" : "0");
      } catch {
        /* ignore */
      }
    }
  }
  function choosePoint(h: string) {
    const v = h.toUpperCase();
    setHex(v);
    update({ point: v });
  }

  const presetHit = PRESETS.find((p) => p.hex.toUpperCase() === s.point);
  const pal = palette(s.point);

  return (
    <div className="settings" aria-busy={!ready}>
      <section className="set-group">
        <h2>외관</h2>

        <div className="set-row">
          <div className="set-label">
            <div className="set-name">포인트 컬러</div>
            <div className="set-desc">활성 메뉴, 주요 버튼, 링크, 표 헤더 바탕, 선택 강조에 쓰입니다. 기본값은 제품 마크 색입니다.</div>
          </div>
          <div className="set-control">
            <div className="toolbar" style={{ margin: 0 }}>
              <span className="color-box" style={{ background: s.point }} aria-hidden />
              <Dropdown
                value={presetHit ? presetHit.hex : CUSTOM}
                options={[...PRESETS.map((p) => ({ value: p.hex, label: `${p.name} (${p.note})` })), { value: CUSTOM, label: "직접 지정" }]}
                onChange={(v) => (v === CUSTOM ? setHex(s.point) : choosePoint(v))}
                ariaLabel="포인트 컬러"
                width={260}
              />
              {(!presetHit || hex !== s.point) && (
                <>
                  <input
                    className="input mono"
                    style={{ width: 110 }}
                    value={hex}
                    placeholder="#0074D2"
                    onChange={(e) => setHex(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && isHex(hex) && choosePoint(hex)}
                    aria-label="hex 값"
                  />
                  <input type="color" className="color-picker" value={isHex(hex) ? hex : s.point} onChange={(e) => choosePoint(e.target.value)} aria-label="색 고르기" />
                  <button type="button" className="btn" disabled={!isHex(hex) || hex.toUpperCase() === s.point} onClick={() => choosePoint(hex)}>
                    적용
                  </button>
                </>
              )}
              {s.point !== DEFAULT_POINT && (
                <button type="button" className="btn" onClick={() => choosePoint(DEFAULT_POINT)}>
                  <Icon as={RotateCcw} />
                  기본값
                </button>
              )}
            </div>
            <div className="set-preview">
              <span className="btn primary">주요 버튼</span>
              <span className="tbl-link">밑줄 링크</span>
              <span className="badge" style={{ background: pal.wash1, color: pal.pointDark }}>
                배지
              </span>
              <span className="pc-chip" style={{ background: pal.wash2, color: pal.pointDark }}>
                선택 칩
              </span>
              <span className="pc-bar">
                <i style={{ width: "60%", background: pal.point }} />
              </span>
              <span className="muted mono" style={{ fontSize: 12 }}>
                {pal.point}
              </span>
            </div>
          </div>
        </div>

        <div className="set-row">
          <div className="set-label">
            <div className="set-name">사이드바 기본 상태</div>
            <div className="set-desc">화면을 열 때 사이드바를 펼칠지 접을지. 접기 버튼으로 언제든 바꿀 수 있습니다.</div>
          </div>
          <div className="set-control">
            <Dropdown
              value={s.sidebar}
              options={[
                { value: "open", label: "펼침" },
                { value: "collapsed", label: "접힘 (아이콘만)" },
              ]}
              onChange={(v) => update({ sidebar: v as Settings["sidebar"] })}
              ariaLabel="사이드바 기본 상태"
              width={200}
            />
          </div>
        </div>
      </section>

      <section className="set-group">
        <h2>표</h2>
        <div className="set-row">
          <div className="set-label">
            <div className="set-name">수기 DB 한 화면 행 수</div>
            <div className="set-desc">답변이 많아 페이지로 나눠 봅니다. 정렬과 필터는 현재 화면 안에서만 적용됩니다.</div>
          </div>
          <div className="set-control">
            <Dropdown
              value={String(s.qnaPageSize)}
              options={[
                { value: "25", label: "25행" },
                { value: "50", label: "50행 (기본)" },
                { value: "100", label: "100행" },
              ]}
              onChange={(v) => update({ qnaPageSize: Number(v) as Settings["qnaPageSize"] })}
              ariaLabel="수기 DB 행 수"
              width={200}
            />
          </div>
        </div>
        <div className="set-row">
          <div className="set-label">
            <div className="set-name">정렬과 필터 기억</div>
            <div className="set-desc">화면을 옮겼다 돌아와도 표의 정렬과 필터를 유지합니다. (준비 중)</div>
          </div>
          <div className="set-control">
            <label className="switch">
              <input type="checkbox" checked={s.rememberTable} onChange={(e) => update({ rememberTable: e.target.checked })} disabled />
              <span>{s.rememberTable ? "켬" : "끔"}</span>
            </label>
          </div>
        </div>
      </section>

      <section className="set-group">
        <h2>AI 러너</h2>
        <div className="set-row">
          <div className="set-label">
            <div className="set-name">꺼짐 판정 기준</div>
            <div className="set-desc">러너의 마지막 신호가 이 시간보다 오래되면 대시보드와 작업 화면에 "꺼짐" 경고를 띄웁니다.</div>
          </div>
          <div className="set-control">
            <Dropdown
              value={String(s.runnerStaleMin)}
              options={[
                { value: "3", label: "3분 (기본)" },
                { value: "10", label: "10분" },
                { value: "30", label: "30분" },
              ]}
              onChange={(v) => update({ runnerStaleMin: Number(v) as Settings["runnerStaleMin"] })}
              ariaLabel="러너 꺼짐 판정 기준"
              width={200}
            />
          </div>
        </div>
      </section>

      <section className="set-group">
        <h2>계정</h2>
        <div className="set-row">
          <div className="set-label">
            <div className="set-name">로그인 계정</div>
            <div className="set-desc">이름과 사진은 Google 계정을 따르고, 역할은 관리자가 지정합니다.</div>
          </div>
          <div className="set-control">
            <div className="toolbar" style={{ margin: 0 }}>
              <Avatar name={user.name} picture={user.picture} />
              <span>
                <b>{user.name}</b> <span className="muted">{user.role}</span>
              </span>
              <Link href="/my" className="tbl-link">
                마이페이지
              </Link>
              <a href="/api/auth/logout" className="tbl-link">
                로그아웃
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="set-group">
        <h2>초기화</h2>
        <div className="set-row">
          <div className="set-label">
            <div className="set-name">모든 설정 기본값으로</div>
            <div className="set-desc">이 브라우저에 저장된 환경설정을 지웁니다.</div>
          </div>
          <div className="set-control">
            <button
              type="button"
              className="btn"
              onClick={() => {
                update({ ...DEFAULT_SETTINGS });
                setHex(DEFAULT_POINT);
                applyPoint(DEFAULT_POINT);
              }}
            >
              <Icon as={RotateCcw} />
              기본값으로 되돌리기
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
