export function dashboardStylePlanList() {
  return `.plan-card .plan-card-head .overview-action-stack {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  white-space: nowrap;
}
.plan-card .plan-card-head .plan-action-icon {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  font-size: 14px;
}
.cross-plan-action-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: end;
  margin-top: 10px;
}
.cross-plan-action-row .meta {
  margin: 0;
}
.cross-plan-action-row .overview-action-stack {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  white-space: nowrap;
}
.cross-plan-action-row .plan-action-icon {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  font-size: 14px;
}`;
}
