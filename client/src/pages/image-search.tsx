import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Camera, X, Loader2, ExternalLink, Upload, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { type Part } from "@shared/schema";

interface WebSearchResult {
  supplier: string;
  searchUrl: string;
  description: string;
}

interface ImageSearchResult {
  identification: string;
  partType: string;
  specifications: string[];
  technicalDetails: string;
  manufacturers: string[];
  searchKeywords: string[];
  webSearchResults: WebSearchResult[];
  inventoryMatches: Array<Part & { confidence: number; matchReason: string }>;
}

export default function ImageSearch() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageSearchResults, setImageSearchResults] = useState<ImageSearchResult | null>(null);

  const imageSearchMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/parts/search-by-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to search by image');
      }
      
      return response.json() as Promise<ImageSearchResult>;
    },
    onSuccess: (data) => {
      console.log("Image search results received:", data);
      console.log("Web search results count:", data.webSearchResults?.length);
      setImageSearchResults(data);
      toast({
        title: "✓ Part Identified Successfully",
        description: `${data.identification.slice(0, 80)}${data.identification.length > 80 ? '...' : ''}. Found ${data.webSearchResults?.length || 0} suppliers.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to identify part",
        variant: "destructive",
      });
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Image must be less than 20MB",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageSearch = () => {
    if (selectedImage) {
      imageSearchMutation.mutate(selectedImage);
    }
  };

  const resetImageSearch = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setImageSearchResults(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">Part Finder</h1>
        <p className="text-muted-foreground">AI-powered image search to identify industrial parts and find suppliers</p>
      </div>

      {/* Image Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Part Image</CardTitle>
          <CardDescription>
            Take a photo of any industrial part to identify it and find suppliers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!imagePreview ? (
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="p-4 rounded-full bg-primary/10">
                  <Camera className="w-12 h-12 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-lg mb-2">Upload an image of the part</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Take a photo of a bearing, motor, belt, valve, or any industrial part
                  </p>
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageSelect}
                  className="max-w-xs"
                  data-testid="input-image-upload"
                />
                <p className="text-xs text-muted-foreground">
                  Supports JPG, PNG, HEIC, WebP • Max 20MB
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden border bg-muted">
                <img 
                  src={imagePreview} 
                  alt="Selected part" 
                  className="w-full h-auto max-h-[500px] object-contain"
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                  }}
                  data-testid="button-remove-image"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={resetImageSearch}
                  data-testid="button-cancel-image-search"
                >
                  Clear
                </Button>
                <Button
                  onClick={handleImageSearch}
                  disabled={imageSearchMutation.isPending}
                  data-testid="button-submit-image-search"
                  size="lg"
                >
                  {imageSearchMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Analyzing Image...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-5 h-5 mr-2" />
                      Identify Part & Find Suppliers
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {imageSearchResults && (
        <div className="space-y-4">
          {/* AI Identification */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="mb-2">AI Identification Results</CardTitle>
                  <CardDescription className="text-base font-medium text-foreground">
                    {imageSearchResults.identification}
                  </CardDescription>
                </div>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={resetImageSearch}
                  data-testid="button-clear-image-search"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {imageSearchResults.technicalDetails && (
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <h4 className="font-medium text-sm mb-2">Technical Details</h4>
                  <p className="text-sm text-muted-foreground">
                    {imageSearchResults.technicalDetails}
                  </p>
                </div>
              )}
              
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Classification & Specifications</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">{imageSearchResults.partType}</Badge>
                  {imageSearchResults.specifications.map((spec, i) => (
                    <Badge key={i} variant="secondary">{spec}</Badge>
                  ))}
                </div>
              </div>

              {imageSearchResults.manufacturers && imageSearchResults.manufacturers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Common Manufacturers</h4>
                  <div className="flex flex-wrap gap-2">
                    {imageSearchResults.manufacturers.map((mfr, i) => (
                      <Badge key={i} variant="outline">{mfr}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {imageSearchResults.searchKeywords && imageSearchResults.searchKeywords.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Search Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {imageSearchResults.searchKeywords.map((keyword, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{keyword}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Web Search Results - PRIMARY FEATURE */}
          <Card className="border-2 border-primary/30">
            <CardHeader className="bg-gradient-to-br from-primary/10 to-primary/5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="w-5 h-5 text-primary" />
                    Where to Find This Part Online
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Click any supplier below to search for pricing and availability
                  </CardDescription>
                </div>
                <Badge variant="default" className="text-sm px-3 py-1">
                  {imageSearchResults.webSearchResults.length} Global Suppliers
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {imageSearchResults.webSearchResults.map((link, i) => (
                  <a
                    key={i}
                    href={link.searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 rounded-md border hover-elevate active-elevate-2 group"
                    data-testid={`link-supplier-${i}`}
                  >
                    <div className="flex-1 pr-2">
                      <div className="font-medium text-sm mb-1">{link.supplier}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{link.description}</div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Inventory Matches */}
          <Card>
            <CardHeader>
              <CardTitle>Your Inventory</CardTitle>
              <CardDescription>
                {imageSearchResults.inventoryMatches.length > 0 
                  ? `Found ${imageSearchResults.inventoryMatches.length} matching parts in your inventory`
                  : 'No matches found in your current inventory'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {imageSearchResults.inventoryMatches.length > 0 ? (
                <div className="space-y-3">
                  {imageSearchResults.inventoryMatches.map((part, i) => (
                    <div 
                      key={i} 
                      className="p-4 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium">{part.name}</div>
                          {part.partNumber && (
                            <div className="text-sm text-muted-foreground">Part #: {part.partNumber}</div>
                          )}
                          {part.machineType && (
                            <div className="text-sm text-muted-foreground">Machine: {part.machineType}</div>
                          )}
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          {Math.round(part.confidence * 100)}% match
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {part.matchReason}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Badge variant={part.stockLevel > (part.minStockLevel || 0) ? "default" : "destructive"}>
                          Stock: {part.stockLevel}
                        </Badge>
                        {part.location && (
                          <Badge variant="outline">Location: {part.location}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border-2 border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    This part is not in your inventory yet. Use the supplier links above to find and purchase it.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Instructions Card (when no search has been performed) */}
      {!imageSearchResults && !imagePreview && (
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">1</span>
                </div>
                <h4 className="font-medium">Upload Photo</h4>
                <p className="text-sm text-muted-foreground">
                  Take or upload a clear photo of the industrial part you need to identify
                </p>
              </div>
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">2</span>
                </div>
                <h4 className="font-medium">AI Analysis</h4>
                <p className="text-sm text-muted-foreground">
                  Our AI analyzes the image and identifies the part type, specifications, and manufacturers
                </p>
              </div>
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold">3</span>
                </div>
                <h4 className="font-medium">Find Suppliers</h4>
                <p className="text-sm text-muted-foreground">
                  Get direct links to search 9+ global suppliers for pricing and availability
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
