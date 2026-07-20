import { Card, CardContent, Skeleton, Stack } from "@mui/material";

export function LoadingCards({ count = 3 }: { count?: number }) {
  return <Stack spacing={1.5} aria-label="Đang tải dữ liệu">
    {Array.from({ length: count }, (_, index) => <Card key={index} variant="outlined"><CardContent>
      <Skeleton width="58%" height={28} /><Skeleton width="82%" /><Skeleton width="40%" />
    </CardContent></Card>)}
  </Stack>;
}
