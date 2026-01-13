'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useCompany } from '@/lib/context/company-context'
import { getReportData, generateAccountingExport } from '@/lib/actions/export'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  FileText,
  DollarSign,
  Users,
  Download,
  Calendar,
} from 'lucide-react'

const STATUS_COLORS = {
  draft: '#94a3b8',
  sent: '#3b82f6',
  paid: '#22c55e',
  overdue: '#ef4444',
  cancelled: '#6b7280',
}

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export default function ReportsPage() {
  const { selectedCompany } = useCompany()
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [reportData, setReportData] = useState<any>(null)

  const today = new Date()
  const firstDayOfYear = new Date(today.getFullYear(), 0, 1)

  const [dateRange, setDateRange] = useState({
    startDate: firstDayOfYear.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  })

  const [exportOptions, setExportOptions] = useState({
    includeInvoices: true,
    includePayments: true,
    format: 'csv' as 'csv' | 'json',
  })

  useEffect(() => {
    if (!selectedCompany) return
    loadReportData()
  }, [selectedCompany, dateRange])

  async function loadReportData() {
    if (!selectedCompany) return
    setLoading(true)
    const result = await getReportData(selectedCompany.id, dateRange.startDate, dateRange.endDate)
    if (result.data) {
      setReportData(result.data)
    }
    setLoading(false)
  }

  async function handleExport() {
    if (!selectedCompany) return
    setExporting(true)

    const result = await generateAccountingExport({
      companyId: selectedCompany.id,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      includeInvoices: exportOptions.includeInvoices,
      includePayments: exportOptions.includePayments,
      format: exportOptions.format,
    })

    if (result.error) {
      toast.error(result.error)
    } else if (result.data && result.filename) {
      const blob = new Blob([result.data], {
        type: exportOptions.format === 'csv' ? 'text/csv' : 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export genere avec succes')
    }

    setExporting(false)
  }

  function setPresetRange(preset: string) {
    const now = new Date()
    let start: Date
    let end: Date = now

    switch (preset) {
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        end = new Date(now.getFullYear(), now.getMonth(), 0)
        break
      case 'thisQuarter':
        const quarter = Math.floor(now.getMonth() / 3)
        start = new Date(now.getFullYear(), quarter * 3, 1)
        break
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1)
        break
      default:
        return
    }

    setDateRange({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    })
  }

  const statusData = reportData
    ? Object.entries(reportData.byStatus).map(([name, value]) => ({
        name: name === 'draft' ? 'Brouillon' :
              name === 'sent' ? 'Envoyee' :
              name === 'paid' ? 'Payee' :
              name === 'overdue' ? 'En retard' : 'Annulee',
        value,
        color: STATUS_COLORS[name as keyof typeof STATUS_COLORS],
      }))
    : []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rapports</h1>
          <p className="text-gray-500 mt-1">Analysez vos performances commerciales</p>
        </div>
      </div>

      <div className="grid gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Periode et Export
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Periode</Label>
                <Select onValueChange={setPresetRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une periode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thisMonth">Ce mois</SelectItem>
                    <SelectItem value="lastMonth">Mois dernier</SelectItem>
                    <SelectItem value="thisQuarter">Ce trimestre</SelectItem>
                    <SelectItem value="thisYear">Cette annee</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date debut</Label>
                <Input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Date fin</Label>
                <Input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Format export</Label>
                <div className="flex gap-2">
                  <Select
                    value={exportOptions.format}
                    onValueChange={(v) => setExportOptions({ ...exportOptions, format: v as 'csv' | 'json' })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleExport} disabled={exporting}>
                    <Download className="h-4 w-4 mr-2" />
                    {exporting ? 'Export...' : 'Exporter'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-6 mt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeInvoices"
                  checked={exportOptions.includeInvoices}
                  onCheckedChange={(checked) =>
                    setExportOptions({ ...exportOptions, includeInvoices: !!checked })
                  }
                />
                <Label htmlFor="includeInvoices">Inclure factures</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includePayments"
                  checked={exportOptions.includePayments}
                  onCheckedChange={(checked) =>
                    setExportOptions({ ...exportOptions, includePayments: !!checked })
                  }
                />
                <Label htmlFor="includePayments">Inclure paiements</Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : reportData ? (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total facture</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reportData.summary.totalInvoiced, selectedCompany?.default_currency || 'EUR')}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">{reportData.summary.invoiceCount} factures</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total encaisse</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(reportData.summary.totalPaid, selectedCompany?.default_currency || 'EUR')}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {((reportData.summary.totalPaid / reportData.summary.totalInvoiced) * 100 || 0).toFixed(1)}% du total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">En retard</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(reportData.summary.totalOverdue, selectedCompany?.default_currency || 'EUR')}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">{reportData.byStatus.overdue} factures</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Taux conversion</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {reportData.summary.conversionRate}%
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">{reportData.summary.quoteCount} devis</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Evolution mensuelle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={reportData.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => {
                          const [year, month] = value.split('-')
                          return new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'short' })
                        }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number) =>
                          formatCurrency(value, selectedCompany?.default_currency || 'EUR')
                        }
                        labelFormatter={(label) => {
                          const [year, month] = label.split('-')
                          return new Date(year, month - 1).toLocaleDateString('fr-FR', {
                            month: 'long',
                            year: 'numeric',
                          })
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="invoiced"
                        name="Facture"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        name="Encaisse"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={{ fill: '#22c55e' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="quotes"
                        name="Devis"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ fill: '#f59e0b' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Statut des factures</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData.filter((d) => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value} facture(s)`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Top 10 Clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.byClient} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="client"
                      tick={{ fontSize: 12 }}
                      width={150}
                    />
                    <Tooltip
                      formatter={(value: number) =>
                        formatCurrency(value, selectedCompany?.default_currency || 'EUR')
                      }
                    />
                    <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                      {reportData.byClient.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-gray-500">Aucune donnee disponible pour cette periode</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
