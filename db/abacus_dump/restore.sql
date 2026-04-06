--
-- NOTE:
--
-- File paths need to be edited. Search for $$PATH$$ and
-- replace it with the path to the directory containing
-- the extracted data files.
--
--
-- PostgreSQL database dump
--

-- Dumped from database version 17.7 (Ubuntu 17.7-3.pgdg24.04+1)
-- Dumped by pg_dump version 17.9 (Ubuntu 17.9-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP DATABASE b02349005;
--
-- Name: b02349005; Type: DATABASE; Schema: -; Owner: role_b02349005
--

CREATE DATABASE b02349005 WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'C.UTF-8';


ALTER DATABASE b02349005 OWNER TO role_b02349005;

\unrestrict (null)
\connect b02349005
\restrict (null)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: role_b02349005
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO role_b02349005;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: role_b02349005
--

COMMENT ON SCHEMA public IS '';


--
-- Name: InvoiceStatus; Type: TYPE; Schema: public; Owner: role_b02349005
--

CREATE TYPE public."InvoiceStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'PAID',
    'OVERDUE',
    'CANCELLED'
);


ALTER TYPE public."InvoiceStatus" OWNER TO role_b02349005;

--
-- Name: InvoiceType; Type: TYPE; Schema: public; Owner: role_b02349005
--

CREATE TYPE public."InvoiceType" AS ENUM (
    'RECEIVABLE',
    'PAYABLE',
    'CREDIT_NOTE',
    'DEBIT_NOTE'
);


ALTER TYPE public."InvoiceType" OWNER TO role_b02349005;

--
-- Name: Priority; Type: TYPE; Schema: public; Owner: role_b02349005
--

CREATE TYPE public."Priority" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);


ALTER TYPE public."Priority" OWNER TO role_b02349005;

--
-- Name: ProjectStatus; Type: TYPE; Schema: public; Owner: role_b02349005
--

CREATE TYPE public."ProjectStatus" AS ENUM (
    'DRAFT',
    'PLANNING',
    'IN_PROGRESS',
    'ON_HOLD',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE public."ProjectStatus" OWNER TO role_b02349005;

--
-- Name: RiskLevel; Type: TYPE; Schema: public; Owner: role_b02349005
--

CREATE TYPE public."RiskLevel" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);


ALTER TYPE public."RiskLevel" OWNER TO role_b02349005;

--
-- Name: TaskStatus; Type: TYPE; Schema: public; Owner: role_b02349005
--

CREATE TYPE public."TaskStatus" AS ENUM (
    'BACKLOG',
    'TODO',
    'IN_PROGRESS',
    'IN_REVIEW',
    'DONE',
    'CANCELLED'
);


ALTER TYPE public."TaskStatus" OWNER TO role_b02349005;

--
-- Name: TransactionType; Type: TYPE; Schema: public; Owner: role_b02349005
--

CREATE TYPE public."TransactionType" AS ENUM (
    'INCOME',
    'EXPENSE',
    'TRANSFER_IN',
    'TRANSFER_OUT'
);


ALTER TYPE public."TransactionType" OWNER TO role_b02349005;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: role_b02349005
--

CREATE TYPE public."UserRole" AS ENUM (
    'ADMIN',
    'PROJECT_MANAGER',
    'TECHNICIAN',
    'COLLABORATOR'
);


ALTER TYPE public."UserRole" OWNER TO role_b02349005;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text
);


ALTER TABLE public."Account" OWNER TO role_b02349005;

--
-- Name: Activity; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Activity" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "projectId" text,
    action text NOT NULL,
    details text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Activity" OWNER TO role_b02349005;

--
-- Name: Attachment; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Attachment" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    "fileName" text NOT NULL,
    "fileSize" integer NOT NULL,
    "fileType" text NOT NULL,
    "cloudStoragePath" text NOT NULL,
    "isPublic" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Attachment" OWNER TO role_b02349005;

--
-- Name: BudgetItemFunding; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."BudgetItemFunding" (
    id text NOT NULL,
    "budgetItemId" text NOT NULL,
    "projectId" text,
    percentage double precision DEFAULT 100 NOT NULL,
    "periodStart" timestamp(3) without time zone,
    "periodEnd" timestamp(3) without time zone,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."BudgetItemFunding" OWNER TO role_b02349005;

--
-- Name: BudgetLine; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."BudgetLine" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    unit text,
    quantity double precision DEFAULT 1 NOT NULL,
    "unitCost" double precision DEFAULT 0 NOT NULL,
    total double precision DEFAULT 0 NOT NULL,
    narrative text DEFAULT ''::text NOT NULL,
    "fundSource" text DEFAULT 'federal'::text NOT NULL,
    "periodStart" timestamp(3) without time zone,
    "periodEnd" timestamp(3) without time zone,
    "order" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."BudgetLine" OWNER TO role_b02349005;

--
-- Name: ChatChannel; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."ChatChannel" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    description text,
    type text DEFAULT 'public'::text NOT NULL,
    "createdBy" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ChatChannel" OWNER TO role_b02349005;

--
-- Name: ChatChannelMember; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."ChatChannelMember" (
    id text NOT NULL,
    "channelId" text NOT NULL,
    "userId" text NOT NULL,
    "lastRead" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ChatChannelMember" OWNER TO role_b02349005;

--
-- Name: ChatMessage; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."ChatMessage" (
    id text NOT NULL,
    "channelId" text NOT NULL,
    "userId" text NOT NULL,
    content text NOT NULL,
    mentions text,
    "fileName" text,
    "fileUrl" text,
    "fileSize" integer,
    "fileType" text,
    "isEdited" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ChatMessage" OWNER TO role_b02349005;

--
-- Name: ChecklistItem; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."ChecklistItem" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    text text NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ChecklistItem" OWNER TO role_b02349005;

--
-- Name: Client; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Client" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    "contactName" text,
    email text,
    phone text,
    address text,
    city text,
    country text,
    "taxId" text,
    type text DEFAULT 'company'::text NOT NULL,
    segment text,
    rating integer,
    notes text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Client" OWNER TO role_b02349005;

--
-- Name: ClientInteraction; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."ClientInteraction" (
    id text NOT NULL,
    "clientId" text NOT NULL,
    type text NOT NULL,
    subject text NOT NULL,
    description text,
    "contactName" text,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "performedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ClientInteraction" OWNER TO role_b02349005;

--
-- Name: Comment; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Comment" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    "userId" text NOT NULL,
    content text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Comment" OWNER TO role_b02349005;

--
-- Name: Company; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Company" (
    id text NOT NULL,
    name text NOT NULL,
    "shortName" text NOT NULL,
    description text,
    logo text,
    color text DEFAULT '#0D9488'::text NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    ein text,
    "incorporationDate" timestamp(3) without time zone,
    "incorporationCountry" text,
    "taxAddress" text,
    "businessActivityCode" text,
    "businessActivity" text,
    "entityType" text
);


ALTER TABLE public."Company" OWNER TO role_b02349005;

--
-- Name: CompanyBudgetItem; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."CompanyBudgetItem" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "budgetLineId" text NOT NULL,
    "subcategoryId" text,
    description text NOT NULL,
    unit text DEFAULT 'month'::text NOT NULL,
    quantity double precision DEFAULT 1 NOT NULL,
    "unitCost" double precision DEFAULT 0 NOT NULL,
    total double precision DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "periodStart" timestamp(3) without time zone,
    "periodEnd" timestamp(3) without time zone,
    note text,
    origin text DEFAULT 'INTERNAL'::text NOT NULL,
    "projectId" text,
    "allocationPct" double precision DEFAULT 100 NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."CompanyBudgetItem" OWNER TO role_b02349005;

--
-- Name: CompanyBudgetLine; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."CompanyBudgetLine" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    "nameEs" text,
    "namePt" text,
    icon text,
    color text DEFAULT '#6B7280'::text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "isSystem" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."CompanyBudgetLine" OWNER TO role_b02349005;

--
-- Name: CompanyBudgetSubcategory; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."CompanyBudgetSubcategory" (
    id text NOT NULL,
    "budgetLineId" text NOT NULL,
    name text NOT NULL,
    "nameEs" text,
    "namePt" text,
    "isSystem" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."CompanyBudgetSubcategory" OWNER TO role_b02349005;

--
-- Name: CompanyUser; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."CompanyUser" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "companyId" text NOT NULL,
    role public."UserRole" DEFAULT 'COLLABORATOR'::public."UserRole" NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."CompanyUser" OWNER TO role_b02349005;

--
-- Name: CustomRole; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."CustomRole" (
    id text NOT NULL,
    "companyId" text,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    code text DEFAULT ''::text NOT NULL,
    level integer DEFAULT 0 NOT NULL,
    permissions text,
    color text DEFAULT '#6b7280'::text NOT NULL,
    "isSystem" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."CustomRole" OWNER TO role_b02349005;

--
-- Name: Department; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Department" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    code text,
    "headId" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Department" OWNER TO role_b02349005;

--
-- Name: DepartmentUser; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."DepartmentUser" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "departmentId" text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."DepartmentUser" OWNER TO role_b02349005;

--
-- Name: Document; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Document" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    description text,
    category text DEFAULT 'general'::text NOT NULL,
    tags text,
    "fileName" text NOT NULL,
    "fileSize" integer NOT NULL,
    "fileType" text NOT NULL,
    "cloudStoragePath" text NOT NULL,
    "isPublic" boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "uploadedBy" text,
    "projectId" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Document" OWNER TO role_b02349005;

--
-- Name: EmployeeContract; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."EmployeeContract" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "userId" text NOT NULL,
    "contractType" text DEFAULT 'full_time'::text NOT NULL,
    "position" text NOT NULL,
    department text,
    salary double precision,
    currency text DEFAULT 'USD'::text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone,
    "workHours" double precision DEFAULT 40,
    "socialSecurity" double precision DEFAULT 0,
    "healthInsurance" double precision DEFAULT 0,
    "otherDeductions" double precision DEFAULT 0,
    bonuses double precision DEFAULT 0,
    notes text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."EmployeeContract" OWNER TO role_b02349005;

--
-- Name: IndicatorMeasurement; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."IndicatorMeasurement" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    "objectiveId" text NOT NULL,
    period text NOT NULL,
    value text NOT NULL,
    notes text,
    source text,
    "collectedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "collectedBy" text,
    status text DEFAULT 'reported'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."IndicatorMeasurement" OWNER TO role_b02349005;

--
-- Name: Invitation; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Invitation" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    email text NOT NULL,
    role public."UserRole" DEFAULT 'COLLABORATOR'::public."UserRole" NOT NULL,
    code text NOT NULL,
    "invitedBy" text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "acceptedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Invitation" OWNER TO role_b02349005;

--
-- Name: Invoice; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Invoice" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "supplierId" text,
    "projectId" text,
    type public."InvoiceType" NOT NULL,
    status public."InvoiceStatus" DEFAULT 'DRAFT'::public."InvoiceStatus" NOT NULL,
    number text NOT NULL,
    description text,
    "contactName" text,
    "contactEmail" text,
    currency text DEFAULT 'USD'::text NOT NULL,
    subtotal double precision DEFAULT 0 NOT NULL,
    "taxRate" double precision DEFAULT 0 NOT NULL,
    "taxAmount" double precision DEFAULT 0 NOT NULL,
    total double precision DEFAULT 0 NOT NULL,
    "issueDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "paidDate" timestamp(3) without time zone,
    notes text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "relatedInvoiceId" text
);


ALTER TABLE public."Invoice" OWNER TO role_b02349005;

--
-- Name: InvoiceItem; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."InvoiceItem" (
    id text NOT NULL,
    "invoiceId" text NOT NULL,
    description text NOT NULL,
    quantity double precision DEFAULT 1 NOT NULL,
    "unitPrice" double precision DEFAULT 0 NOT NULL,
    total double precision DEFAULT 0 NOT NULL,
    "order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public."InvoiceItem" OWNER TO role_b02349005;

--
-- Name: LabInvite; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."LabInvite" (
    id text NOT NULL,
    email text NOT NULL,
    code text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "invitedById" text NOT NULL,
    "userId" text,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."LabInvite" OWNER TO role_b02349005;

--
-- Name: LeaveRequest; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."LeaveRequest" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    days double precision NOT NULL,
    reason text,
    "reviewedBy" text,
    "reviewedAt" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."LeaveRequest" OWNER TO role_b02349005;

--
-- Name: MEReport; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."MEReport" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    title text NOT NULL,
    type text DEFAULT 'progress'::text NOT NULL,
    period text,
    content text DEFAULT ''::text NOT NULL,
    findings text,
    recommendations text,
    status text DEFAULT 'draft'::text NOT NULL,
    "reportDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."MEReport" OWNER TO role_b02349005;

--
-- Name: Milestone; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Milestone" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    name text NOT NULL,
    description text,
    "dueDate" timestamp(3) without time zone,
    completed boolean DEFAULT false NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "order" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Milestone" OWNER TO role_b02349005;

--
-- Name: MuseSuggestion; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."MuseSuggestion" (
    id text NOT NULL,
    title text NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    rationale text,
    priority text DEFAULT 'MEDIUM'::text NOT NULL,
    status text DEFAULT 'NEW'::text NOT NULL,
    source text,
    "createdById" text,
    "companyId" text,
    "projectId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."MuseSuggestion" OWNER TO role_b02349005;

--
-- Name: Notification; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    link text,
    read boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Notification" OWNER TO role_b02349005;

--
-- Name: Objective; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Objective" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    "parentId" text,
    type text DEFAULT 'objective'::text NOT NULL,
    code text,
    title text NOT NULL,
    description text,
    indicator text,
    "indicatorType" text,
    "unitOfMeasure" text,
    "dataSource" text,
    disaggregation text,
    "reportingFreq" text,
    responsibility text,
    "dataLimitations" text,
    baseline text,
    target text,
    actual text,
    status text DEFAULT 'not_started'::text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Objective" OWNER TO role_b02349005;

--
-- Name: Product; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Product" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    sku text,
    description text,
    category text,
    unit text DEFAULT 'unidad'::text NOT NULL,
    "costPrice" double precision,
    "salePrice" double precision,
    currency text DEFAULT 'USD'::text NOT NULL,
    "stockQty" double precision DEFAULT 0 NOT NULL,
    "minStock" double precision,
    location text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Product" OWNER TO role_b02349005;

--
-- Name: Project; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Project" (
    id text NOT NULL,
    name text NOT NULL,
    code text,
    description text,
    goal text,
    "companyId" text NOT NULL,
    "donorName" text,
    "donorContact" text,
    status public."ProjectStatus" DEFAULT 'DRAFT'::public."ProjectStatus" NOT NULL,
    priority public."Priority" DEFAULT 'MEDIUM'::public."Priority" NOT NULL,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    budget double precision DEFAULT 0 NOT NULL,
    spent double precision DEFAULT 0 NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    country text,
    region text,
    currency text DEFAULT 'USD'::text NOT NULL,
    color text DEFAULT '#60B5FF'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Project" OWNER TO role_b02349005;

--
-- Name: ProjectMember; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."ProjectMember" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    "userId" text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dedicationPct" double precision DEFAULT 100 NOT NULL,
    "monthlyCost" double precision,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ProjectMember" OWNER TO role_b02349005;

--
-- Name: PurchaseOrder; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."PurchaseOrder" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "supplierId" text NOT NULL,
    number text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    subtotal double precision DEFAULT 0 NOT NULL,
    "taxRate" double precision DEFAULT 0 NOT NULL,
    "taxAmount" double precision DEFAULT 0 NOT NULL,
    total double precision DEFAULT 0 NOT NULL,
    "orderDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expectedDate" timestamp(3) without time zone,
    "receivedDate" timestamp(3) without time zone,
    notes text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."PurchaseOrder" OWNER TO role_b02349005;

--
-- Name: PurchaseOrderItem; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."PurchaseOrderItem" (
    id text NOT NULL,
    "purchaseOrderId" text NOT NULL,
    description text NOT NULL,
    quantity double precision DEFAULT 1 NOT NULL,
    "unitPrice" double precision DEFAULT 0 NOT NULL,
    total double precision DEFAULT 0 NOT NULL,
    "order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public."PurchaseOrderItem" OWNER TO role_b02349005;

--
-- Name: Risk; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Risk" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    title text NOT NULL,
    description text,
    level public."RiskLevel" DEFAULT 'MEDIUM'::public."RiskLevel" NOT NULL,
    impact text,
    mitigation text,
    status text DEFAULT 'open'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Risk" OWNER TO role_b02349005;

--
-- Name: SOWSection; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."SOWSection" (
    id text NOT NULL,
    "projectId" text NOT NULL,
    "sectionKey" text NOT NULL,
    title text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."SOWSection" OWNER TO role_b02349005;

--
-- Name: Session; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Session" OWNER TO role_b02349005;

--
-- Name: Stakeholder; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Stakeholder" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    "contactName" text,
    email text,
    phone text,
    address text,
    city text,
    country text,
    "taxId" text,
    type text DEFAULT 'ong'::text NOT NULL,
    "allianceType" text,
    status text DEFAULT 'active'::text NOT NULL,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    website text,
    sector text,
    description text,
    notes text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Stakeholder" OWNER TO role_b02349005;

--
-- Name: StakeholderInteraction; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."StakeholderInteraction" (
    id text NOT NULL,
    "stakeholderId" text NOT NULL,
    type text NOT NULL,
    subject text NOT NULL,
    description text,
    "contactName" text,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "performedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."StakeholderInteraction" OWNER TO role_b02349005;

--
-- Name: StockMovement; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."StockMovement" (
    id text NOT NULL,
    "productId" text NOT NULL,
    "companyId" text NOT NULL,
    type text NOT NULL,
    quantity double precision NOT NULL,
    reference text,
    reason text,
    notes text,
    "performedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."StockMovement" OWNER TO role_b02349005;

--
-- Name: Supplier; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Supplier" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    "tradeName" text,
    "taxId" text,
    email text,
    phone text,
    address text,
    city text,
    country text,
    category text,
    rating integer,
    notes text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Supplier" OWNER TO role_b02349005;

--
-- Name: SupplierEvaluation; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."SupplierEvaluation" (
    id text NOT NULL,
    "supplierId" text NOT NULL,
    quality integer DEFAULT 3 NOT NULL,
    delivery integer DEFAULT 3 NOT NULL,
    price integer DEFAULT 3 NOT NULL,
    communication integer DEFAULT 3 NOT NULL,
    compliance integer DEFAULT 3 NOT NULL,
    comment text,
    "evaluationDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."SupplierEvaluation" OWNER TO role_b02349005;

--
-- Name: Task; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Task" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    "projectId" text,
    "companyId" text,
    "assigneeId" text,
    "creatorId" text NOT NULL,
    "parentId" text,
    status public."TaskStatus" DEFAULT 'TODO'::public."TaskStatus" NOT NULL,
    priority public."Priority" DEFAULT 'MEDIUM'::public."Priority" NOT NULL,
    "startDate" timestamp(3) without time zone,
    "dueDate" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "estimatedHours" double precision,
    "order" integer DEFAULT 0 NOT NULL,
    tags text,
    "isActive" boolean DEFAULT true NOT NULL,
    "isRecurring" boolean DEFAULT false NOT NULL,
    "recurrenceMonths" integer,
    "recurrenceGroup" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "departmentId" text
);


ALTER TABLE public."Task" OWNER TO role_b02349005;

--
-- Name: TaskDependency; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."TaskDependency" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    "dependsOnTaskId" text NOT NULL,
    type text DEFAULT 'finish_to_start'::text NOT NULL,
    "lagDays" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TaskDependency" OWNER TO role_b02349005;

--
-- Name: TaskTemplate; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."TaskTemplate" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "companyId" text,
    category text,
    tasks jsonb NOT NULL,
    "createdBy" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."TaskTemplate" OWNER TO role_b02349005;

--
-- Name: TaxFiling; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."TaxFiling" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "formType" text NOT NULL,
    "taxYear" integer NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    "formData" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "autoData" jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    "filedDate" timestamp(3) without time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."TaxFiling" OWNER TO role_b02349005;

--
-- Name: TimeEntry; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."TimeEntry" (
    id text NOT NULL,
    "taskId" text NOT NULL,
    "userId" text NOT NULL,
    hours double precision NOT NULL,
    description text,
    date timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TimeEntry" OWNER TO role_b02349005;

--
-- Name: Transaction; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."Transaction" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "projectId" text,
    type public."TransactionType" NOT NULL,
    amount double precision NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    title text,
    description text,
    category text,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "accrualDate" timestamp(3) without time zone,
    "isRecurring" boolean DEFAULT false NOT NULL,
    "recurrenceMonths" integer,
    "executionStatus" text DEFAULT 'FORECAST'::text NOT NULL,
    "executedDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "budgetLineId" text,
    scope text DEFAULT 'SHARED'::text NOT NULL,
    "companyAmount" double precision,
    note text,
    origin text,
    "companyBudgetItemId" text,
    "receiptUrl" text
);


ALTER TABLE public."Transaction" OWNER TO role_b02349005;

--
-- Name: TransactionCategory; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."TransactionCategory" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#6B7280'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TransactionCategory" OWNER TO role_b02349005;

--
-- Name: User; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."User" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password text DEFAULT ''::text NOT NULL,
    "emailVerified" timestamp(3) without time zone,
    image text,
    role public."UserRole" DEFAULT 'COLLABORATOR'::public."UserRole" NOT NULL,
    avatar text,
    phone text,
    locale text DEFAULT 'es'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."User" OWNER TO role_b02349005;

--
-- Name: VerificationToken; Type: TABLE; Schema: public; Owner: role_b02349005
--

CREATE TABLE public."VerificationToken" (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."VerificationToken" OWNER TO role_b02349005;

--
-- Data for Name: Account; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Account" (id, "userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state) FROM stdin;
\.
COPY public."Account" (id, "userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state) FROM '$$PATH$$/4079.dat';

--
-- Data for Name: Activity; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Activity" (id, "userId", "projectId", action, details, "createdAt") FROM stdin;
\.
COPY public."Activity" (id, "userId", "projectId", action, details, "createdAt") FROM '$$PATH$$/4105.dat';

--
-- Data for Name: Attachment; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Attachment" (id, "taskId", "fileName", "fileSize", "fileType", "cloudStoragePath", "isPublic", "createdAt") FROM stdin;
\.
COPY public."Attachment" (id, "taskId", "fileName", "fileSize", "fileType", "cloudStoragePath", "isPublic", "createdAt") FROM '$$PATH$$/4095.dat';

--
-- Data for Name: BudgetItemFunding; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."BudgetItemFunding" (id, "budgetItemId", "projectId", percentage, "periodStart", "periodEnd", note, "createdAt", "updatedAt") FROM stdin;
\.
COPY public."BudgetItemFunding" (id, "budgetItemId", "projectId", percentage, "periodStart", "periodEnd", note, "createdAt", "updatedAt") FROM '$$PATH$$/4104.dat';

--
-- Data for Name: BudgetLine; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."BudgetLine" (id, "projectId", category, description, unit, quantity, "unitCost", total, narrative, "fundSource", "periodStart", "periodEnd", "order", "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."BudgetLine" (id, "projectId", category, description, unit, quantity, "unitCost", total, narrative, "fundSource", "periodStart", "periodEnd", "order", "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4129.dat';

--
-- Data for Name: ChatChannel; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."ChatChannel" (id, "companyId", name, description, type, "createdBy", "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."ChatChannel" (id, "companyId", name, description, type, "createdBy", "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4123.dat';

--
-- Data for Name: ChatChannelMember; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."ChatChannelMember" (id, "channelId", "userId", "lastRead", "createdAt") FROM stdin;
\.
COPY public."ChatChannelMember" (id, "channelId", "userId", "lastRead", "createdAt") FROM '$$PATH$$/4124.dat';

--
-- Data for Name: ChatMessage; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."ChatMessage" (id, "channelId", "userId", content, mentions, "fileName", "fileUrl", "fileSize", "fileType", "isEdited", "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."ChatMessage" (id, "channelId", "userId", content, mentions, "fileName", "fileUrl", "fileSize", "fileType", "isEdited", "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4125.dat';

--
-- Data for Name: ChecklistItem; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."ChecklistItem" (id, "taskId", text, completed, "order", "createdAt") FROM stdin;
\.
COPY public."ChecklistItem" (id, "taskId", text, completed, "order", "createdAt") FROM '$$PATH$$/4093.dat';

--
-- Data for Name: Client; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Client" (id, "companyId", name, "contactName", email, phone, address, city, country, "taxId", type, segment, rating, notes, "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."Client" (id, "companyId", name, "contactName", email, phone, address, city, country, "taxId", type, segment, rating, notes, "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4114.dat';

--
-- Data for Name: ClientInteraction; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."ClientInteraction" (id, "clientId", type, subject, description, "contactName", date, "performedBy", "createdAt") FROM stdin;
\.
COPY public."ClientInteraction" (id, "clientId", type, subject, description, "contactName", date, "performedBy", "createdAt") FROM '$$PATH$$/4119.dat';

--
-- Data for Name: Comment; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Comment" (id, "taskId", "userId", content, "createdAt", "updatedAt") FROM stdin;
\.
COPY public."Comment" (id, "taskId", "userId", content, "createdAt", "updatedAt") FROM '$$PATH$$/4094.dat';

--
-- Data for Name: Company; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Company" (id, name, "shortName", description, logo, color, currency, "isActive", "createdAt", "updatedAt", ein, "incorporationDate", "incorporationCountry", "taxAddress", "businessActivityCode", "businessActivity", "entityType") FROM stdin;
\.
COPY public."Company" (id, name, "shortName", description, logo, color, currency, "isActive", "createdAt", "updatedAt", ein, "incorporationDate", "incorporationCountry", "taxAddress", "businessActivityCode", "businessActivity", "entityType") FROM '$$PATH$$/4082.dat';

--
-- Data for Name: CompanyBudgetItem; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."CompanyBudgetItem" (id, "companyId", "budgetLineId", "subcategoryId", description, unit, quantity, "unitCost", total, currency, "periodStart", "periodEnd", note, origin, "projectId", "allocationPct", "order", "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."CompanyBudgetItem" (id, "companyId", "budgetLineId", "subcategoryId", description, unit, quantity, "unitCost", total, currency, "periodStart", "periodEnd", note, origin, "projectId", "allocationPct", "order", "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4103.dat';

--
-- Data for Name: CompanyBudgetLine; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."CompanyBudgetLine" (id, "companyId", name, "nameEs", "namePt", icon, color, "order", "isSystem", "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."CompanyBudgetLine" (id, "companyId", name, "nameEs", "namePt", icon, color, "order", "isSystem", "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4101.dat';

--
-- Data for Name: CompanyBudgetSubcategory; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."CompanyBudgetSubcategory" (id, "budgetLineId", name, "nameEs", "namePt", "isSystem", "isActive", "createdAt") FROM stdin;
\.
COPY public."CompanyBudgetSubcategory" (id, "budgetLineId", name, "nameEs", "namePt", "isSystem", "isActive", "createdAt") FROM '$$PATH$$/4102.dat';

--
-- Data for Name: CompanyUser; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."CompanyUser" (id, "userId", "companyId", role, "isDefault", "createdAt") FROM stdin;
\.
COPY public."CompanyUser" (id, "userId", "companyId", role, "isDefault", "createdAt") FROM '$$PATH$$/4084.dat';

--
-- Data for Name: CustomRole; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."CustomRole" (id, "companyId", name, description, code, level, permissions, color, "isSystem", "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."CustomRole" (id, "companyId", name, description, code, level, permissions, color, "isSystem", "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4086.dat';

--
-- Data for Name: Department; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Department" (id, "companyId", name, code, "headId", "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."Department" (id, "companyId", name, code, "headId", "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4083.dat';

--
-- Data for Name: DepartmentUser; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."DepartmentUser" (id, "userId", "departmentId", role, "createdAt") FROM stdin;
\.
COPY public."DepartmentUser" (id, "userId", "departmentId", role, "createdAt") FROM '$$PATH$$/4085.dat';

--
-- Data for Name: Document; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Document" (id, "companyId", name, description, category, tags, "fileName", "fileSize", "fileType", "cloudStoragePath", "isPublic", version, "uploadedBy", "projectId", "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."Document" (id, "companyId", name, description, category, tags, "fileName", "fileSize", "fileType", "cloudStoragePath", "isPublic", version, "uploadedBy", "projectId", "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4117.dat';

--
-- Data for Name: EmployeeContract; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."EmployeeContract" (id, "companyId", "userId", "contractType", "position", department, salary, currency, "startDate", "endDate", "workHours", "socialSecurity", "healthInsurance", "otherDeductions", bonuses, notes, "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."EmployeeContract" (id, "companyId", "userId", "contractType", "position", department, salary, currency, "startDate", "endDate", "workHours", "socialSecurity", "healthInsurance", "otherDeductions", bonuses, notes, "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4111.dat';

--
-- Data for Name: IndicatorMeasurement; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."IndicatorMeasurement" (id, "projectId", "objectiveId", period, value, notes, source, "collectedAt", "collectedBy", status, "createdAt", "updatedAt") FROM stdin;
\.
COPY public."IndicatorMeasurement" (id, "projectId", "objectiveId", period, value, notes, source, "collectedAt", "collectedBy", status, "createdAt", "updatedAt") FROM '$$PATH$$/4130.dat';

--
-- Data for Name: Invitation; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Invitation" (id, "companyId", email, role, code, "invitedBy", status, "expiresAt", "acceptedAt", "createdAt") FROM stdin;
\.
COPY public."Invitation" (id, "companyId", email, role, code, "invitedBy", status, "expiresAt", "acceptedAt", "createdAt") FROM '$$PATH$$/4112.dat';

--
-- Data for Name: Invoice; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Invoice" (id, "companyId", "supplierId", "projectId", type, status, number, description, "contactName", "contactEmail", currency, subtotal, "taxRate", "taxAmount", total, "issueDate", "dueDate", "paidDate", notes, "isActive", "createdAt", "updatedAt", "relatedInvoiceId") FROM stdin;
\.
COPY public."Invoice" (id, "companyId", "supplierId", "projectId", type, status, number, description, "contactName", "contactEmail", currency, subtotal, "taxRate", "taxAmount", total, "issueDate", "dueDate", "paidDate", notes, "isActive", "createdAt", "updatedAt", "relatedInvoiceId") FROM '$$PATH$$/4107.dat';

--
-- Data for Name: InvoiceItem; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."InvoiceItem" (id, "invoiceId", description, quantity, "unitPrice", total, "order") FROM stdin;
\.
COPY public."InvoiceItem" (id, "invoiceId", description, quantity, "unitPrice", total, "order") FROM '$$PATH$$/4108.dat';

--
-- Data for Name: LabInvite; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."LabInvite" (id, email, code, status, "invitedById", "userId", "expiresAt", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."LabInvite" (id, email, code, status, "invitedById", "userId", "expiresAt", "createdAt", "updatedAt") FROM '$$PATH$$/4127.dat';

--
-- Data for Name: LeaveRequest; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."LeaveRequest" (id, "companyId", "userId", type, status, "startDate", "endDate", days, reason, "reviewedBy", "reviewedAt", notes, "createdAt", "updatedAt") FROM stdin;
\.
COPY public."LeaveRequest" (id, "companyId", "userId", type, status, "startDate", "endDate", days, reason, "reviewedBy", "reviewedAt", notes, "createdAt", "updatedAt") FROM '$$PATH$$/4120.dat';

--
-- Data for Name: MEReport; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."MEReport" (id, "projectId", title, type, period, content, findings, recommendations, status, "reportDate", "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."MEReport" (id, "projectId", title, type, period, content, findings, recommendations, status, "reportDate", "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4131.dat';

--
-- Data for Name: Milestone; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Milestone" (id, "projectId", name, description, "dueDate", completed, "completedAt", "order", "createdAt") FROM stdin;
\.
COPY public."Milestone" (id, "projectId", name, description, "dueDate", completed, "completedAt", "order", "createdAt") FROM '$$PATH$$/4097.dat';

--
-- Data for Name: MuseSuggestion; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."MuseSuggestion" (id, title, category, description, rationale, priority, status, source, "createdById", "companyId", "projectId", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."MuseSuggestion" (id, title, category, description, rationale, priority, status, source, "createdById", "companyId", "projectId", "createdAt", "updatedAt") FROM '$$PATH$$/4126.dat';

--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Notification" (id, "userId", type, title, message, link, read, "createdAt") FROM stdin;
\.
COPY public."Notification" (id, "userId", type, title, message, link, read, "createdAt") FROM '$$PATH$$/4106.dat';

--
-- Data for Name: Objective; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Objective" (id, "projectId", "parentId", type, code, title, description, indicator, "indicatorType", "unitOfMeasure", "dataSource", disaggregation, "reportingFreq", responsibility, "dataLimitations", baseline, target, actual, status, "order", "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."Objective" (id, "projectId", "parentId", type, code, title, description, indicator, "indicatorType", "unitOfMeasure", "dataSource", disaggregation, "reportingFreq", responsibility, "dataLimitations", baseline, target, actual, status, "order", "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4087.dat';

--
-- Data for Name: Product; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Product" (id, "companyId", name, sku, description, category, unit, "costPrice", "salePrice", currency, "stockQty", "minStock", location, "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."Product" (id, "companyId", name, sku, description, category, unit, "costPrice", "salePrice", currency, "stockQty", "minStock", location, "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4113.dat';

--
-- Data for Name: Project; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Project" (id, name, code, description, goal, "companyId", "donorName", "donorContact", status, priority, "startDate", "endDate", budget, spent, progress, country, region, currency, color, "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."Project" (id, name, code, description, goal, "companyId", "donorName", "donorContact", status, priority, "startDate", "endDate", budget, spent, progress, country, region, currency, color, "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4088.dat';

--
-- Data for Name: ProjectMember; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."ProjectMember" (id, "projectId", "userId", role, "createdAt", "dedicationPct", "monthlyCost", "updatedAt") FROM stdin;
\.
COPY public."ProjectMember" (id, "projectId", "userId", role, "createdAt", "dedicationPct", "monthlyCost", "updatedAt") FROM '$$PATH$$/4089.dat';

--
-- Data for Name: PurchaseOrder; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."PurchaseOrder" (id, "companyId", "supplierId", number, status, currency, subtotal, "taxRate", "taxAmount", total, "orderDate", "expectedDate", "receivedDate", notes, "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."PurchaseOrder" (id, "companyId", "supplierId", number, status, currency, subtotal, "taxRate", "taxAmount", total, "orderDate", "expectedDate", "receivedDate", notes, "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4121.dat';

--
-- Data for Name: PurchaseOrderItem; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."PurchaseOrderItem" (id, "purchaseOrderId", description, quantity, "unitPrice", total, "order") FROM stdin;
\.
COPY public."PurchaseOrderItem" (id, "purchaseOrderId", description, quantity, "unitPrice", total, "order") FROM '$$PATH$$/4122.dat';

--
-- Data for Name: Risk; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Risk" (id, "projectId", title, description, level, impact, mitigation, status, "createdAt", "updatedAt") FROM stdin;
\.
COPY public."Risk" (id, "projectId", title, description, level, impact, mitigation, status, "createdAt", "updatedAt") FROM '$$PATH$$/4098.dat';

--
-- Data for Name: SOWSection; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."SOWSection" (id, "projectId", "sectionKey", title, content, "order", "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."SOWSection" (id, "projectId", "sectionKey", title, content, "order", "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4128.dat';

--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Session" (id, "sessionToken", "userId", expires) FROM stdin;
\.
COPY public."Session" (id, "sessionToken", "userId", expires) FROM '$$PATH$$/4080.dat';

--
-- Data for Name: Stakeholder; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Stakeholder" (id, "companyId", name, "contactName", email, phone, address, city, country, "taxId", type, "allianceType", status, "startDate", "endDate", website, sector, description, notes, "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."Stakeholder" (id, "companyId", name, "contactName", email, phone, address, city, country, "taxId", type, "allianceType", status, "startDate", "endDate", website, sector, description, notes, "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4115.dat';

--
-- Data for Name: StakeholderInteraction; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."StakeholderInteraction" (id, "stakeholderId", type, subject, description, "contactName", date, "performedBy", "createdAt") FROM stdin;
\.
COPY public."StakeholderInteraction" (id, "stakeholderId", type, subject, description, "contactName", date, "performedBy", "createdAt") FROM '$$PATH$$/4116.dat';

--
-- Data for Name: StockMovement; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."StockMovement" (id, "productId", "companyId", type, quantity, reference, reason, notes, "performedBy", "createdAt") FROM stdin;
\.
COPY public."StockMovement" (id, "productId", "companyId", type, quantity, reference, reason, notes, "performedBy", "createdAt") FROM '$$PATH$$/4118.dat';

--
-- Data for Name: Supplier; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Supplier" (id, "companyId", name, "tradeName", "taxId", email, phone, address, city, country, category, rating, notes, "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."Supplier" (id, "companyId", name, "tradeName", "taxId", email, phone, address, city, country, category, rating, notes, "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4109.dat';

--
-- Data for Name: SupplierEvaluation; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."SupplierEvaluation" (id, "supplierId", quality, delivery, price, communication, compliance, comment, "evaluationDate", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."SupplierEvaluation" (id, "supplierId", quality, delivery, price, communication, compliance, comment, "evaluationDate", "createdAt", "updatedAt") FROM '$$PATH$$/4110.dat';

--
-- Data for Name: Task; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Task" (id, title, description, "projectId", "companyId", "assigneeId", "creatorId", "parentId", status, priority, "startDate", "dueDate", "completedAt", "estimatedHours", "order", tags, "isActive", "isRecurring", "recurrenceMonths", "recurrenceGroup", "createdAt", "updatedAt", "departmentId") FROM stdin;
\.
COPY public."Task" (id, title, description, "projectId", "companyId", "assigneeId", "creatorId", "parentId", status, priority, "startDate", "dueDate", "completedAt", "estimatedHours", "order", tags, "isActive", "isRecurring", "recurrenceMonths", "recurrenceGroup", "createdAt", "updatedAt", "departmentId") FROM '$$PATH$$/4090.dat';

--
-- Data for Name: TaskDependency; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."TaskDependency" (id, "taskId", "dependsOnTaskId", type, "lagDays", "createdAt") FROM stdin;
\.
COPY public."TaskDependency" (id, "taskId", "dependsOnTaskId", type, "lagDays", "createdAt") FROM '$$PATH$$/4091.dat';

--
-- Data for Name: TaskTemplate; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."TaskTemplate" (id, name, description, "companyId", category, tasks, "createdBy", "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."TaskTemplate" (id, name, description, "companyId", category, tasks, "createdBy", "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4092.dat';

--
-- Data for Name: TaxFiling; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."TaxFiling" (id, "companyId", "formType", "taxYear", status, "formData", "autoData", notes, "filedDate", "isActive", "createdById", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."TaxFiling" (id, "companyId", "formType", "taxYear", status, "formData", "autoData", notes, "filedDate", "isActive", "createdById", "createdAt", "updatedAt") FROM '$$PATH$$/4132.dat';

--
-- Data for Name: TimeEntry; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."TimeEntry" (id, "taskId", "userId", hours, description, date, "createdAt") FROM stdin;
\.
COPY public."TimeEntry" (id, "taskId", "userId", hours, description, date, "createdAt") FROM '$$PATH$$/4096.dat';

--
-- Data for Name: Transaction; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."Transaction" (id, "companyId", "projectId", type, amount, currency, title, description, category, date, "accrualDate", "isRecurring", "recurrenceMonths", "executionStatus", "executedDate", "createdAt", "budgetLineId", scope, "companyAmount", note, origin, "companyBudgetItemId", "receiptUrl") FROM stdin;
\.
COPY public."Transaction" (id, "companyId", "projectId", type, amount, currency, title, description, category, date, "accrualDate", "isRecurring", "recurrenceMonths", "executionStatus", "executedDate", "createdAt", "budgetLineId", scope, "companyAmount", note, origin, "companyBudgetItemId", "receiptUrl") FROM '$$PATH$$/4099.dat';

--
-- Data for Name: TransactionCategory; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."TransactionCategory" (id, "companyId", name, color, "isActive", "createdAt") FROM stdin;
\.
COPY public."TransactionCategory" (id, "companyId", name, color, "isActive", "createdAt") FROM '$$PATH$$/4100.dat';

--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."User" (id, name, email, password, "emailVerified", image, role, avatar, phone, locale, "isActive", "createdAt", "updatedAt") FROM stdin;
\.
COPY public."User" (id, name, email, password, "emailVerified", image, role, avatar, phone, locale, "isActive", "createdAt", "updatedAt") FROM '$$PATH$$/4078.dat';

--
-- Data for Name: VerificationToken; Type: TABLE DATA; Schema: public; Owner: role_b02349005
--

COPY public."VerificationToken" (identifier, token, expires) FROM stdin;
\.
COPY public."VerificationToken" (identifier, token, expires) FROM '$$PATH$$/4081.dat';

--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: Activity Activity_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Activity"
    ADD CONSTRAINT "Activity_pkey" PRIMARY KEY (id);


--
-- Name: Attachment Attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_pkey" PRIMARY KEY (id);


--
-- Name: BudgetItemFunding BudgetItemFunding_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."BudgetItemFunding"
    ADD CONSTRAINT "BudgetItemFunding_pkey" PRIMARY KEY (id);


--
-- Name: BudgetLine BudgetLine_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."BudgetLine"
    ADD CONSTRAINT "BudgetLine_pkey" PRIMARY KEY (id);


--
-- Name: ChatChannelMember ChatChannelMember_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."ChatChannelMember"
    ADD CONSTRAINT "ChatChannelMember_pkey" PRIMARY KEY (id);


--
-- Name: ChatChannel ChatChannel_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."ChatChannel"
    ADD CONSTRAINT "ChatChannel_pkey" PRIMARY KEY (id);


--
-- Name: ChatMessage ChatMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_pkey" PRIMARY KEY (id);


--
-- Name: ChecklistItem ChecklistItem_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."ChecklistItem"
    ADD CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY (id);


--
-- Name: ClientInteraction ClientInteraction_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."ClientInteraction"
    ADD CONSTRAINT "ClientInteraction_pkey" PRIMARY KEY (id);


--
-- Name: Client Client_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_pkey" PRIMARY KEY (id);


--
-- Name: Comment Comment_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_pkey" PRIMARY KEY (id);


--
-- Name: CompanyBudgetItem CompanyBudgetItem_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."CompanyBudgetItem"
    ADD CONSTRAINT "CompanyBudgetItem_pkey" PRIMARY KEY (id);


--
-- Name: CompanyBudgetLine CompanyBudgetLine_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."CompanyBudgetLine"
    ADD CONSTRAINT "CompanyBudgetLine_pkey" PRIMARY KEY (id);


--
-- Name: CompanyBudgetSubcategory CompanyBudgetSubcategory_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."CompanyBudgetSubcategory"
    ADD CONSTRAINT "CompanyBudgetSubcategory_pkey" PRIMARY KEY (id);


--
-- Name: CompanyUser CompanyUser_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."CompanyUser"
    ADD CONSTRAINT "CompanyUser_pkey" PRIMARY KEY (id);


--
-- Name: Company Company_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Company"
    ADD CONSTRAINT "Company_pkey" PRIMARY KEY (id);


--
-- Name: CustomRole CustomRole_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."CustomRole"
    ADD CONSTRAINT "CustomRole_pkey" PRIMARY KEY (id);


--
-- Name: DepartmentUser DepartmentUser_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."DepartmentUser"
    ADD CONSTRAINT "DepartmentUser_pkey" PRIMARY KEY (id);


--
-- Name: Department Department_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_pkey" PRIMARY KEY (id);


--
-- Name: Document Document_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_pkey" PRIMARY KEY (id);


--
-- Name: EmployeeContract EmployeeContract_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."EmployeeContract"
    ADD CONSTRAINT "EmployeeContract_pkey" PRIMARY KEY (id);


--
-- Name: IndicatorMeasurement IndicatorMeasurement_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."IndicatorMeasurement"
    ADD CONSTRAINT "IndicatorMeasurement_pkey" PRIMARY KEY (id);


--
-- Name: Invitation Invitation_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_pkey" PRIMARY KEY (id);


--
-- Name: InvoiceItem InvoiceItem_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."InvoiceItem"
    ADD CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY (id);


--
-- Name: Invoice Invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY (id);


--
-- Name: LabInvite LabInvite_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."LabInvite"
    ADD CONSTRAINT "LabInvite_pkey" PRIMARY KEY (id);


--
-- Name: LeaveRequest LeaveRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY (id);


--
-- Name: MEReport MEReport_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."MEReport"
    ADD CONSTRAINT "MEReport_pkey" PRIMARY KEY (id);


--
-- Name: Milestone Milestone_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Milestone"
    ADD CONSTRAINT "Milestone_pkey" PRIMARY KEY (id);


--
-- Name: MuseSuggestion MuseSuggestion_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."MuseSuggestion"
    ADD CONSTRAINT "MuseSuggestion_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: Objective Objective_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Objective"
    ADD CONSTRAINT "Objective_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: ProjectMember ProjectMember_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."ProjectMember"
    ADD CONSTRAINT "ProjectMember_pkey" PRIMARY KEY (id);


--
-- Name: Project Project_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY (id);


--
-- Name: PurchaseOrderItem PurchaseOrderItem_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."PurchaseOrderItem"
    ADD CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY (id);


--
-- Name: PurchaseOrder PurchaseOrder_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."PurchaseOrder"
    ADD CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY (id);


--
-- Name: Risk Risk_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Risk"
    ADD CONSTRAINT "Risk_pkey" PRIMARY KEY (id);


--
-- Name: SOWSection SOWSection_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."SOWSection"
    ADD CONSTRAINT "SOWSection_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: StakeholderInteraction StakeholderInteraction_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."StakeholderInteraction"
    ADD CONSTRAINT "StakeholderInteraction_pkey" PRIMARY KEY (id);


--
-- Name: Stakeholder Stakeholder_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Stakeholder"
    ADD CONSTRAINT "Stakeholder_pkey" PRIMARY KEY (id);


--
-- Name: StockMovement StockMovement_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."StockMovement"
    ADD CONSTRAINT "StockMovement_pkey" PRIMARY KEY (id);


--
-- Name: SupplierEvaluation SupplierEvaluation_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."SupplierEvaluation"
    ADD CONSTRAINT "SupplierEvaluation_pkey" PRIMARY KEY (id);


--
-- Name: Supplier Supplier_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Supplier"
    ADD CONSTRAINT "Supplier_pkey" PRIMARY KEY (id);


--
-- Name: TaskDependency TaskDependency_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."TaskDependency"
    ADD CONSTRAINT "TaskDependency_pkey" PRIMARY KEY (id);


--
-- Name: TaskTemplate TaskTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."TaskTemplate"
    ADD CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY (id);


--
-- Name: Task Task_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_pkey" PRIMARY KEY (id);


--
-- Name: TaxFiling TaxFiling_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."TaxFiling"
    ADD CONSTRAINT "TaxFiling_pkey" PRIMARY KEY (id);


--
-- Name: TimeEntry TimeEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."TimeEntry"
    ADD CONSTRAINT "TimeEntry_pkey" PRIMARY KEY (id);


--
-- Name: TransactionCategory TransactionCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."TransactionCategory"
    ADD CONSTRAINT "TransactionCategory_pkey" PRIMARY KEY (id);


--
-- Name: Transaction Transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Account_provider_providerAccountId_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON public."Account" USING btree (provider, "providerAccountId");


--
-- Name: BudgetItemFunding_budgetItemId_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "BudgetItemFunding_budgetItemId_idx" ON public."BudgetItemFunding" USING btree ("budgetItemId");


--
-- Name: BudgetItemFunding_projectId_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "BudgetItemFunding_projectId_idx" ON public."BudgetItemFunding" USING btree ("projectId");


--
-- Name: BudgetLine_projectId_category_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "BudgetLine_projectId_category_idx" ON public."BudgetLine" USING btree ("projectId", category);


--
-- Name: BudgetLine_projectId_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "BudgetLine_projectId_idx" ON public."BudgetLine" USING btree ("projectId");


--
-- Name: ChatChannelMember_channelId_userId_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "ChatChannelMember_channelId_userId_key" ON public."ChatChannelMember" USING btree ("channelId", "userId");


--
-- Name: CompanyBudgetItem_budgetLineId_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "CompanyBudgetItem_budgetLineId_idx" ON public."CompanyBudgetItem" USING btree ("budgetLineId");


--
-- Name: CompanyBudgetItem_companyId_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "CompanyBudgetItem_companyId_idx" ON public."CompanyBudgetItem" USING btree ("companyId");


--
-- Name: CompanyBudgetItem_projectId_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "CompanyBudgetItem_projectId_idx" ON public."CompanyBudgetItem" USING btree ("projectId");


--
-- Name: CompanyBudgetLine_companyId_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "CompanyBudgetLine_companyId_idx" ON public."CompanyBudgetLine" USING btree ("companyId");


--
-- Name: CompanyBudgetLine_companyId_name_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "CompanyBudgetLine_companyId_name_key" ON public."CompanyBudgetLine" USING btree ("companyId", name);


--
-- Name: CompanyBudgetSubcategory_budgetLineId_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "CompanyBudgetSubcategory_budgetLineId_idx" ON public."CompanyBudgetSubcategory" USING btree ("budgetLineId");


--
-- Name: CompanyBudgetSubcategory_budgetLineId_name_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "CompanyBudgetSubcategory_budgetLineId_name_key" ON public."CompanyBudgetSubcategory" USING btree ("budgetLineId", name);


--
-- Name: CompanyUser_userId_companyId_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "CompanyUser_userId_companyId_key" ON public."CompanyUser" USING btree ("userId", "companyId");


--
-- Name: CustomRole_name_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "CustomRole_name_key" ON public."CustomRole" USING btree (name);


--
-- Name: DepartmentUser_userId_departmentId_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "DepartmentUser_userId_departmentId_key" ON public."DepartmentUser" USING btree ("userId", "departmentId");


--
-- Name: IndicatorMeasurement_objectiveId_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "IndicatorMeasurement_objectiveId_idx" ON public."IndicatorMeasurement" USING btree ("objectiveId");


--
-- Name: IndicatorMeasurement_projectId_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "IndicatorMeasurement_projectId_idx" ON public."IndicatorMeasurement" USING btree ("projectId");


--
-- Name: IndicatorMeasurement_projectId_period_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "IndicatorMeasurement_projectId_period_idx" ON public."IndicatorMeasurement" USING btree ("projectId", period);


--
-- Name: Invitation_code_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "Invitation_code_key" ON public."Invitation" USING btree (code);


--
-- Name: LabInvite_code_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "LabInvite_code_idx" ON public."LabInvite" USING btree (code);


--
-- Name: LabInvite_code_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "LabInvite_code_key" ON public."LabInvite" USING btree (code);


--
-- Name: LabInvite_email_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "LabInvite_email_idx" ON public."LabInvite" USING btree (email);


--
-- Name: MEReport_projectId_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "MEReport_projectId_idx" ON public."MEReport" USING btree ("projectId");


--
-- Name: MEReport_projectId_type_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "MEReport_projectId_type_idx" ON public."MEReport" USING btree ("projectId", type);


--
-- Name: ProjectMember_projectId_userId_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON public."ProjectMember" USING btree ("projectId", "userId");


--
-- Name: SOWSection_projectId_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "SOWSection_projectId_idx" ON public."SOWSection" USING btree ("projectId");


--
-- Name: SOWSection_projectId_sectionKey_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "SOWSection_projectId_sectionKey_key" ON public."SOWSection" USING btree ("projectId", "sectionKey");


--
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");


--
-- Name: TaskDependency_taskId_dependsOnTaskId_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "TaskDependency_taskId_dependsOnTaskId_key" ON public."TaskDependency" USING btree ("taskId", "dependsOnTaskId");


--
-- Name: TaxFiling_companyId_formType_taxYear_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "TaxFiling_companyId_formType_taxYear_key" ON public."TaxFiling" USING btree ("companyId", "formType", "taxYear");


--
-- Name: TaxFiling_companyId_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "TaxFiling_companyId_idx" ON public."TaxFiling" USING btree ("companyId");


--
-- Name: TransactionCategory_companyId_name_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "TransactionCategory_companyId_name_key" ON public."TransactionCategory" USING btree ("companyId", name);


--
-- Name: Transaction_budgetLineId_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "Transaction_budgetLineId_idx" ON public."Transaction" USING btree ("budgetLineId");


--
-- Name: Transaction_companyBudgetItemId_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "Transaction_companyBudgetItemId_idx" ON public."Transaction" USING btree ("companyBudgetItemId");


--
-- Name: Transaction_scope_idx; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE INDEX "Transaction_scope_idx" ON public."Transaction" USING btree (scope);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: VerificationToken_identifier_token_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON public."VerificationToken" USING btree (identifier, token);


--
-- Name: VerificationToken_token_key; Type: INDEX; Schema: public; Owner: role_b02349005
--

CREATE UNIQUE INDEX "VerificationToken_token_key" ON public."VerificationToken" USING btree (token);


--
-- Name: Account Account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Activity Activity_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Activity"
    ADD CONSTRAINT "Activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Activity Activity_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Activity"
    ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Attachment Attachment_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BudgetItemFunding BudgetItemFunding_budgetItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."BudgetItemFunding"
    ADD CONSTRAINT "BudgetItemFunding_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES public."CompanyBudgetItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BudgetItemFunding BudgetItemFunding_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."BudgetItemFunding"
    ADD CONSTRAINT "BudgetItemFunding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BudgetLine BudgetLine_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."BudgetLine"
    ADD CONSTRAINT "BudgetLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChatChannelMember ChatChannelMember_channelId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."ChatChannelMember"
    ADD CONSTRAINT "ChatChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES public."ChatChannel"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChatChannelMember ChatChannelMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."ChatChannelMember"
    ADD CONSTRAINT "ChatChannelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChatChannel ChatChannel_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."ChatChannel"
    ADD CONSTRAINT "ChatChannel_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChatMessage ChatMessage_channelId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES public."ChatChannel"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChatMessage ChatMessage_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChecklistItem ChecklistItem_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."ChecklistItem"
    ADD CONSTRAINT "ChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ClientInteraction ClientInteraction_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."ClientInteraction"
    ADD CONSTRAINT "ClientInteraction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Client Client_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comment Comment_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comment Comment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CompanyBudgetItem CompanyBudgetItem_budgetLineId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."CompanyBudgetItem"
    ADD CONSTRAINT "CompanyBudgetItem_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES public."CompanyBudgetLine"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CompanyBudgetItem CompanyBudgetItem_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."CompanyBudgetItem"
    ADD CONSTRAINT "CompanyBudgetItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CompanyBudgetItem CompanyBudgetItem_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."CompanyBudgetItem"
    ADD CONSTRAINT "CompanyBudgetItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CompanyBudgetItem CompanyBudgetItem_subcategoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."CompanyBudgetItem"
    ADD CONSTRAINT "CompanyBudgetItem_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES public."CompanyBudgetSubcategory"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CompanyBudgetLine CompanyBudgetLine_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."CompanyBudgetLine"
    ADD CONSTRAINT "CompanyBudgetLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CompanyBudgetSubcategory CompanyBudgetSubcategory_budgetLineId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."CompanyBudgetSubcategory"
    ADD CONSTRAINT "CompanyBudgetSubcategory_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES public."CompanyBudgetLine"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CompanyUser CompanyUser_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."CompanyUser"
    ADD CONSTRAINT "CompanyUser_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CompanyUser CompanyUser_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."CompanyUser"
    ADD CONSTRAINT "CompanyUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CustomRole CustomRole_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."CustomRole"
    ADD CONSTRAINT "CustomRole_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DepartmentUser DepartmentUser_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."DepartmentUser"
    ADD CONSTRAINT "DepartmentUser_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DepartmentUser DepartmentUser_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."DepartmentUser"
    ADD CONSTRAINT "DepartmentUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Department Department_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Document Document_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmployeeContract EmployeeContract_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."EmployeeContract"
    ADD CONSTRAINT "EmployeeContract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EmployeeContract EmployeeContract_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."EmployeeContract"
    ADD CONSTRAINT "EmployeeContract_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: IndicatorMeasurement IndicatorMeasurement_objectiveId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."IndicatorMeasurement"
    ADD CONSTRAINT "IndicatorMeasurement_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES public."Objective"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: IndicatorMeasurement IndicatorMeasurement_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."IndicatorMeasurement"
    ADD CONSTRAINT "IndicatorMeasurement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invitation Invitation_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invitation Invitation_invitedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceItem InvoiceItem_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."InvoiceItem"
    ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invoice Invoice_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invoice Invoice_relatedInvoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_relatedInvoiceId_fkey" FOREIGN KEY ("relatedInvoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invoice Invoice_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public."Supplier"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LabInvite LabInvite_invitedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."LabInvite"
    ADD CONSTRAINT "LabInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LabInvite LabInvite_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."LabInvite"
    ADD CONSTRAINT "LabInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LeaveRequest LeaveRequest_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."LeaveRequest"
    ADD CONSTRAINT "LeaveRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MEReport MEReport_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."MEReport"
    ADD CONSTRAINT "MEReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Milestone Milestone_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Milestone"
    ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MuseSuggestion MuseSuggestion_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."MuseSuggestion"
    ADD CONSTRAINT "MuseSuggestion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MuseSuggestion MuseSuggestion_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."MuseSuggestion"
    ADD CONSTRAINT "MuseSuggestion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MuseSuggestion MuseSuggestion_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."MuseSuggestion"
    ADD CONSTRAINT "MuseSuggestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Objective Objective_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Objective"
    ADD CONSTRAINT "Objective_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Objective"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Objective Objective_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Objective"
    ADD CONSTRAINT "Objective_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Product Product_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProjectMember ProjectMember_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."ProjectMember"
    ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProjectMember ProjectMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."ProjectMember"
    ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Project Project_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PurchaseOrderItem PurchaseOrderItem_purchaseOrderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."PurchaseOrderItem"
    ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES public."PurchaseOrder"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PurchaseOrder PurchaseOrder_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."PurchaseOrder"
    ADD CONSTRAINT "PurchaseOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PurchaseOrder PurchaseOrder_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."PurchaseOrder"
    ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public."Supplier"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Risk Risk_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Risk"
    ADD CONSTRAINT "Risk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SOWSection SOWSection_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."SOWSection"
    ADD CONSTRAINT "SOWSection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StakeholderInteraction StakeholderInteraction_stakeholderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."StakeholderInteraction"
    ADD CONSTRAINT "StakeholderInteraction_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES public."Stakeholder"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Stakeholder Stakeholder_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Stakeholder"
    ADD CONSTRAINT "Stakeholder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StockMovement StockMovement_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."StockMovement"
    ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupplierEvaluation SupplierEvaluation_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."SupplierEvaluation"
    ADD CONSTRAINT "SupplierEvaluation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public."Supplier"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Supplier Supplier_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Supplier"
    ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskDependency TaskDependency_dependsOnTaskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."TaskDependency"
    ADD CONSTRAINT "TaskDependency_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskDependency TaskDependency_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."TaskDependency"
    ADD CONSTRAINT "TaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaskTemplate TaskTemplate_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."TaskTemplate"
    ADD CONSTRAINT "TaskTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TaskTemplate TaskTemplate_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."TaskTemplate"
    ADD CONSTRAINT "TaskTemplate_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_assigneeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Task Task_creatorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Task Task_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Task Task_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaxFiling TaxFiling_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."TaxFiling"
    ADD CONSTRAINT "TaxFiling_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaxFiling TaxFiling_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."TaxFiling"
    ADD CONSTRAINT "TaxFiling_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TimeEntry TimeEntry_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."TimeEntry"
    ADD CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TimeEntry TimeEntry_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."TimeEntry"
    ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TransactionCategory TransactionCategory_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."TransactionCategory"
    ADD CONSTRAINT "TransactionCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Transaction Transaction_budgetLineId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES public."BudgetLine"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Transaction Transaction_companyBudgetItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_companyBudgetItemId_fkey" FOREIGN KEY ("companyBudgetItemId") REFERENCES public."CompanyBudgetItem"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Transaction Transaction_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Transaction Transaction_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: role_b02349005
--

ALTER TABLE ONLY public."Transaction"
    ADD CONSTRAINT "Transaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DATABASE b02349005; Type: ACL; Schema: -; Owner: role_b02349005
--

REVOKE CONNECT,TEMPORARY ON DATABASE b02349005 FROM PUBLIC;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: role_b02349005
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

