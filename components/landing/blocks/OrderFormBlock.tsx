import { Printer } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { OrderForm } from "@/components/customer/OrderForm";
import { Button } from "@/components/ui/button";
import type { OrderFormConfig } from "@/lib/order-form-config";
import { pick, type Localized, type Background } from "@/lib/landing/blocks";
import type { Locale } from "@/i18n/locale";
import { sectionBackground, tone } from "./section";
import { Editable } from "./Editable";
import { BlockToolbar } from "@/components/landing/edit/BlockToolbar";

export interface OrderFormData {
  background: Background;
  label: Localized;
  headline: Localized;
  subheadline: Localized;
}

/**
 * Runtime state the block cannot own: whether public intake is open at all, and
 * what the form is allowed to ask for. Comes from settings, not from the editor.
 */
export interface OrderFormContext {
  accessCodeEnabled: boolean;
  orderFormConfig: OrderFormConfig;
  publicIntakeEnabled: boolean;
  portalEnabled: boolean;
  registrationOpen: boolean;
}

export async function OrderFormBlock({
  data,
  locale,
  blockId,
  editing,
  context,
}: {
  data: OrderFormData;
  locale: Locale;
  blockId: string;
  editing: boolean;
  context: OrderFormContext;
}) {
  const t = await getTranslations("landing");
  const bg = sectionBackground(data.background);
  const colors = tone(data.background);
  const accountOnly = !context.publicIntakeEnabled;

  // With intake closed the section speaks for the system, not for the admin's
  // copy — those strings stay in i18n rather than becoming editable fields, and
  // are therefore not inline-editable either.
  const label = pick(data.label, locale);
  const headline = accountOnly ? t("order_account_only_headline") : pick(data.headline, locale);
  const subheadline = accountOnly
    ? t("order_account_only_subheadline")
    : pick(data.subheadline, locale);
  const editableCopy = editing && !accountOnly;

  return (
    <section
      id="order-form"
      data-landing-block={blockId}
      className={`relative py-24 scroll-mt-20 ${bg.className}`}
      style={bg.style}
    >
      {editing && <BlockToolbar blockId={blockId} type="order_form" />}
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          {(label || editableCopy) && (
            <p
              className="text-sm font-medium tracking-widest uppercase mb-3"
              style={{ color: "var(--landing-accent)" }}
            >
              <Editable editing={editableCopy} blockId={blockId} field="label">
                {label}
              </Editable>
            </p>
          )}
          {(headline || editableCopy) && (
            <h2
              className={`text-4xl ${colors.headline} mb-4`}
              style={{ fontFamily: "var(--font-dm-serif)" }}
            >
              <Editable editing={editableCopy} blockId={blockId} field="headline">
                {headline}
              </Editable>
            </h2>
          )}
          {(subheadline || editableCopy) && (
            <p className={`${colors.body} text-lg max-w-xl mx-auto`} style={colors.bodyStyle}>
              <Editable editing={editableCopy} blockId={blockId} field="subheadline">
                {subheadline}
              </Editable>
            </p>
          )}
        </div>
        {accountOnly ? (
          <AccountOnlyNotice
            portalEnabled={context.portalEnabled}
            registrationOpen={context.registrationOpen}
          />
        ) : (
          <OrderForm
            accessCodeEnabled={context.accessCodeEnabled}
            config={context.orderFormConfig}
          />
        )}
      </div>
    </section>
  );
}

// Shown instead of the form when a shop takes orders from account holders only.
async function AccountOnlyNotice({
  portalEnabled,
  registrationOpen,
}: {
  portalEnabled: boolean;
  registrationOpen: boolean;
}) {
  const t = await getTranslations("landing");
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <Printer className="h-6 w-6" style={{ color: "var(--landing-accent)" }} />
      </div>
      <p className="text-gray-600">
        {portalEnabled ? t("order_account_only_body") : t("order_account_only_contact")}
      </p>
      {portalEnabled && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/portal/signin">{t("order_account_only_signin_cta")}</Link>
          </Button>
          {registrationOpen && (
            <Button asChild variant="outline">
              <Link href="/portal/register">{t("order_account_only_register_cta")}</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
