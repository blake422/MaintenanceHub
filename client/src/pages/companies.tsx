import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Users, Settings } from "lucide-react";

export default function Companies() {
  const companies = [
    {
      id: "comp-1",
      name: "Acme Manufacturing",
      description: "Industrial equipment manufacturing",
      userCount: 45,
      equipmentCount: 120,
      status: "active",
    },
    {
      id: "comp-2",
      name: "TechCorp Industries",
      description: "High-tech assembly operations",
      userCount: 28,
      equipmentCount: 85,
      status: "active",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">Companies</h1>
          <p className="text-muted-foreground">Manage multi-tenant company accounts</p>
        </div>
        <Button data-testid="button-add-company">
          <Plus className="w-4 h-4 mr-2" />
          Add Company
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-companies">
              {companies.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-users">
              {companies.reduce((acc, c) => acc + c.userCount, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Equipment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-equipment">
              {companies.reduce((acc, c) => acc + c.equipmentCount, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Companies List */}
      <div className="space-y-4">
        {companies.map((company) => (
          <Card key={company.id} className="hover-elevate">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-base">{company.name}</CardTitle>
                    <Badge variant="default" className="capitalize">
                      {company.status}
                    </Badge>
                  </div>
                  <CardDescription>{company.description}</CardDescription>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Users</p>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <p className="font-medium">{company.userCount}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Equipment</p>
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    <p className="font-medium">{company.equipmentCount}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" data-testid={`button-manage-${company.id}`}>
                  Manage
                </Button>
                <Button size="sm" variant="ghost" data-testid={`button-settings-${company.id}`}>
                  Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
